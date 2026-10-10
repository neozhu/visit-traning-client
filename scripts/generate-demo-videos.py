"""Regenerate the six-second offline teaching clips: Pillow + an FFmpeg executable."""
import argparse
from pathlib import Path
import subprocess
from PIL import Image, ImageDraw, ImageFont

parser = argparse.ArgumentParser()
parser.add_argument('--ffmpeg', required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1] / 'miniprogram' / 'assets'
video_dir = root / 'videos'
video_dir.mkdir(parents=True, exist_ok=True)
font_path = 'C:/Windows/Fonts/msyh.ttc'
heading = ImageFont.truetype(font_path, 34)
body = ImageFont.truetype(font_path, 24)
small = ImageFont.truetype(font_path, 18)
clips = {
 'safety': ('生产区域安全须知', ['走标识清晰的人行通道', '未经授权，不操作机器设备', '紧急情况沿疏散指示撤离']),
 'ppe': ('个人防护用品使用', ['进入生产区域，正确佩戴安全帽', '按现场要求配齐防护用品', '发现安全隐患，立即报告']),
 'research': ('实验室访问与防护', ['由授权人员陪同进入实验室', '不触碰试剂，不擅自操作设备', '佩戴防护用品，禁止饮食']),
 'office': ('公共区域与应急疏散', ['熟悉安全出口与集合地点', '遵守禁烟规定，不堵塞通道', '火警时有序撤离，不乘电梯']),
 'traffic': ('厂区行车与装卸安全', ['遵守限速与指定行车路线', '人车分流，司机走人行通道', '车辆停靠与装卸服从现场指挥']),
 'construction': ('施工许可与现场防护', ['确认作业许可和人员资质', '做好隔离防护，正确佩戴安全帽', '发现危险，停止作业并报告'])
}
for name, (title, rules) in clips.items():
 command = [args.ffmpeg, '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '640x360', '-r', '12', '-i', 'pipe:0',
            '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100', '-t', '6', '-c:v', 'libx264', '-preset', 'veryfast',
            '-crf', '28', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '32k', '-shortest', '-movflags', '+faststart', str(video_dir / f'{name}.mp4')]
 process = subprocess.Popen(command, stdin=subprocess.PIPE)
 for frame in range(72):
  image = Image.new('RGB', (640, 360), '#122b49')
  draw = ImageDraw.Draw(image)
  draw.rounded_rectangle((32,28,146,58), radius=12, fill='#21476f')
  draw.text((46,31), 'VisitSafe', font=small, fill='#bcd6ff')
  draw.text((40,80), title, font=heading, fill='white')
  slide = min(2, frame // 24)
  draw.rounded_rectangle((40,145,600,256), radius=18, fill='#1e4065')
  draw.ellipse((60,177,110,227), fill='#2d84ef')
  draw.text((77,185), str(slide + 1), font=body, fill='white')
  draw.text((130,187), rules[slide], font=body, fill='white')
  draw.text((40,287), '安全要点  /  短版教学演示', font=small, fill='#b6cce4')
  draw.rounded_rectangle((40,330,600,336), radius=3, fill='#355373')
  draw.rounded_rectangle((40,330,40+max(2,int(560*(frame+1)/72)),336), radius=3, fill='#59a5ff')
  if name == 'safety' and frame == 0:
   image.save(root / 'lesson-cover.png')
  process.stdin.write(image.tobytes())
 process.stdin.close()
 if process.wait() != 0:
  raise RuntimeError(f'Encoding failed: {name}')
 print(f'{name}.mp4: 6 seconds')
