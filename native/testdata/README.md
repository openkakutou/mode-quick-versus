# Test fixtures

`content/stages/arena.wav` is 0.2 s of a 440 Hz sine (8000 Hz, mono, 16-bit),
the stage music used by the audio tests. Regenerate it with:

```
python3 -c "import wave,math,struct;w=wave.open('content/stages/arena.wav','wb');w.setnchannels(1);w.setsampwidth(2);w.setframerate(8000);w.writeframes(b''.join(struct.pack('<h',int(12000*math.sin(2*math.pi*440*i/8000))) for i in range(1600)));w.close()"
```
