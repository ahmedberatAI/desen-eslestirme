# Gerçek test verisi: kaynaklar ve lisanslar

Bu klasördeki iki dosya, doğruluk testlerinde ve doğrulama kümesindeki gerçek veri vakalarında kullanılır.
İkisi de MIT lisanslıdır; lisans metinleri aşağıda olduğu gibi korunmuştur.

| Dosya | İçerik | Biçim | Boyut | Kaynak |
|---|---|---|---|---|
| `train_gpt2.c` | GPT-2'yi saf C ile eğiten başvuru kaynak dosyası (karpathy/llm.c) | düz metin, **tek belge** | 50 680 karakter, 1 182 satır | `https://github.com/karpathy/llm.c/blob/f1e2ace651495b74ae22d45d1723443fd00ecd3a/train_gpt2.c` |
| `humaneval.jsonl` | OpenAI HumanEval kod üretme kıyaslaması: 164 problem | JSONL, **164 belge** | 103 560 karakter metin | `https://github.com/openai/human-eval/blob/b9453e8f1865df0a0057a1383767caa400acfbcf/data/HumanEval.jsonl.gz` |

- `train_gpt2.c` hiç değiştirilmeden kopyalanmıştır (satır sonları LF; SHA-256
  `6737a6c0945f5ac04d8fb534100506be9871df8c406995b34b84b3deec661258`).
- `humaneval.jsonl`, özgün `HumanEval.jsonl` dosyasından şu dönüşümle üretilmiştir:
  her satır için `{ "id": task_id, "text": prompt + canonical_solution }` (diğer alanlar atıldı,
  sıra korundu). İlk belge `HumanEval/0` 600 karakter, en kısa 132, en uzun 1 993 karakterdir.

Neden bu iki veri? Tek uzun belge (bir yapay zekâ modelinin eğitim kodu) kod araması / statik analiz
senaryosunu; çok sayıda kısa belge (bir LLM değerlendirme kıyaslaması) ise eğitim derlemlerinde
kıyaslama sızıntısı (benchmark contamination) taraması gibi çok belgeli akış senaryosunu temsil eder.

---

## karpathy/llm.c — `train_gpt2.c`

```
MIT License

Copyright (c) 2024 Andrej Karpathy

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## openai/human-eval — `HumanEval.jsonl`

```
The MIT License

Copyright (c) OpenAI (https://openai.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```
