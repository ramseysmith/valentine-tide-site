from parts import *
body = barrel_wave(500, 800, 620)
open("wave-test.svg", "w").write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000"><rect width="1000" height="1000" fill="{INK}"/>{body}</svg>')
