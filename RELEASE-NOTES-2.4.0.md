# EymClient 2.4.0

## Sponsor Sunucular
- Launcher Ana Sayfa'da Sponsor Sunucular bölümü.
- Ayrı Sunucular sayfası.
- Sponsor sunucular `https://client.eymdev.com.tr/data/sponsors.json` üzerinden okunur.
- Uzak yapılandırmaya ulaşılamazsa launcher içindeki `src/data/sponsors.json` kullanılır.
- Minecraft profili başlatılmadan önce sponsor sunucular `servers.dat` içine otomatik olarak en üst sıraya alınır.
- Sponsor sunucular normal sunucuların üzerine yazılmaz; normal sunucular korunur.

## Modrinth Mod Merkezi
- Modrinth'in güncel `/v2/search` API'si ile gerçek mod araması.
- Minecraft sürümü filtresi.
- Fabric / Forge / NeoForge loader filtresi.
- Proje sürümlerini listeleme.
- Seçilen Modrinth sürümünü indirme.
- Gerekli Modrinth bağımlılıklarını otomatik indirme.
- İndirme/kurulum durumlarının launcher loguna aktarılması.
- Eski sabit hızlı mod listesi korunur; tam Modrinth merkezi ayrıca kullanılabilir.

## Korunan Sistemler
- Microsoft / Offline hesaplar.
- İzole Minecraft sürüm klasörleri.
- Fabric başlatma.
- RAM yönetimi.
- Optimize profilleri.
- Discord Rich Presence.
- Electron auto-update.
