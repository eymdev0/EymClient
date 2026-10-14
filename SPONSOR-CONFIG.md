# Sponsor Sunucu Yapılandırması

Launcher şu adresi kontrol eder:

`https://client.eymdev.com.tr/data/sponsors.json`

Dosya yoksa launcher kendi içindeki `src/data/sponsors.json` dosyasına düşer.

Örnek:

```json
{
  "sponsors": [
    {
      "id": "ornek-sunucu",
      "enabled": true,
      "name": "Örnek Sunucu",
      "address": "play.ornek.com:25565",
      "description": "Sponsor sunucu açıklaması",
      "icon": "https://example.com/server-icon.png"
    }
  ]
}
```

Alanlar:
- `id`: benzersiz sponsor kimliği
- `enabled`: `false` ise gösterilmez
- `name`: Minecraft sunucu listesinde görünecek ad
- `address`: IP veya domain ve gerekiyorsa port
- `description`: launcher kartındaki açıklama
- `icon`: PNG/JPG/WEBP gibi erişilebilir bir görsel URL'si

Sponsor sunucular launcher tarafından Minecraft profilinin `servers.dat` dosyasına en üstte eklenir.
