# Canlı demo (sunumun 5. slaytı, ~45 sn). Depo kök dizininde çalıştırın:
#   powershell -ExecutionPolicy Bypass -File presentation/demo/demo.ps1
# Her adımdan sonra Enter'a basın. Veri: GPT-2'yi C ile eğiten llm.c kaynak dosyası (tests/data/train_gpt2.c).

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Set-Location (Join-Path $PSScriptRoot '..\..')

function Step($title, [scriptblock]$cmd) {
  Write-Host "`n=== $title ===" -ForegroundColor Cyan
  & $cmd
  Read-Host "`n[Enter]" | Out-Null
}

Step '1) GPT-2 eğitim kodunda bir çekirdek fonksiyonun bütün geçişleri: molekül neyi seçiyor?' {
  Write-Host '$ node bin/ios.js explain --patterns attention_forward < train_gpt2.c' -ForegroundColor DarkGray
  node presentation/demo/explain-summary.js --patterns attention_forward
}

Step '2) Aynı dosya, 300 tanımlayıcı (sembol listesi): karar değişiyor' {
  Write-Host '$ node bin/ios.js explain --patterns-file desenler300.txt < train_gpt2.c' -ForegroundColor DarkGray
  node presentation/demo/explain-summary.js --patterns-file presentation/demo/desenler300.txt
}

Step '3) Eşleşmeler (JSONL)' {
  node bin/ios.js run ExactMatch --patterns attention_forward --input tests/data/train_gpt2.c --quiet | Select-Object -First 3
}

Step '4) Zorla seçilen strateji aynı sonucu verir' {
  $a = node bin/ios.js run ExactMatch --patterns attention_forward --input tests/data/train_gpt2.c --quiet
  $b = node bin/ios.js run ExactMatch --patterns attention_forward --input tests/data/train_gpt2.c --quiet --strategy KmpSearch
  if (($a -join "`n") -eq ($b -join "`n")) { Write-Host "auto ve KmpSearch: AYNI ($($a.Count) eşleşme)" -ForegroundColor Green } else { Write-Host 'FARKLI!' -ForegroundColor Red }
}
