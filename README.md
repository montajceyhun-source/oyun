# Sevgi Büdcəsi Auksionu

"Xüsusiyyətlər Auksionu" təlim məşqinin canlı, çoxoyunçulu veb versiyası.
- **Aparıcı** öz telefonundan/kompüterindən lotları idarə edir.
- **İştirakçılar** (4–6 nəfər) öz telefonlarından linklə qoşulub canlı təklif verirlər.
- Backend **Google Apps Script** üzərindədir (server, verilənlər bazası əvəzinə) — heç bir ödənişli hosting lazım deyil.
- Frontend sadə statik sayt (HTML/CSS/JS) — **Vercel**-ə birbaşa yüklənir.

## 1. Backend-i qurun (Google Apps Script)

1. [script.google.com](https://script.google.com) → **Yeni layihə**.
2. Default `Code.gs` faylının içini silin, bu repodakı `apps-script/Code.gs` faylının tam məzmununu yapışdırın.
3. Yuxarı sağda **Yayımla → Yeni yayım**:
   - Tip: **Veb tətbiq (Web app)**
   - İcra edən: **Mən (özünüz)**
   - Girişi olanlar: **Hər kəs (Anyone)**
4. "Yayımla" düyməsinə basın, Google icazə istəyəcək — təsdiqləyin.
5. Sizə `https://script.google.com/macros/s/XXXXXXXX/exec` formatında bir **URL** veriləcək. Bunu saxlayın.

> **Qeyd:** Kodu hər dəyişdirəndə "Yeni yayım" yaratmağa ehtiyac yoxdur — mövcud yayımı **Redaktə et (pencil icon) → Yeni versiya** ilə yeniləyə bilərsiniz, URL eyni qalır.

### (İstəyə bağlı) Nəticələrin daimi qeydi
Əgər hər oyunun nəticəsini Google Sheet-də saxlamaq istəyirsinizsə:
1. Yeni Google Sheet yaradın, URL-dəki ID hissəsini kopyalayın.
2. `Code.gs` faylının yuxarısındakı `SHEET_ID` sətrinə yapışdırın.
3. Yenidən yayımlayın (yuxarıdakı qeydə bax).
Bu addımı atlasanız da oyun normal işləyəcək, sadəcə tarixçə saxlanmayacaq.

## 2. Frontend-i qonfiqurasiya edin

`api.js` faylını açın və bu sətri tapın:

```js
const CONFIG = {
  APPS_SCRIPT_URL: 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE'
};
```

`PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE` yerinə 1-ci addımda aldığınız `.../exec` linkini yazın.

## 3. GitHub-a yükləyin

```bash
cd auksionu
git init
git add .
git commit -m "Sevgi Büdcəsi Auksionu — ilk versiya"
git branch -M main
git remote add origin https://github.com/<istifadeci-adiniz>/<repo-adi>.git
git push -u origin main
```

## 4. Vercel-də deploy edin

**Vercel Dashboard ilə (ən asan yol):**
1. [vercel.com/new](https://vercel.com/new) → GitHub reponuzu seçin → **Import**.
2. Framework: "Other" / statik sayt olaraq tanınacaq (heç bir build əmri lazım deyil, "Build Command" boş qala bilər).
3. **Deploy** basın. Bir neçə saniyəyə saytınız `https://<layihe-adi>.vercel.app` ünvanında hazır olacaq.

**Və ya Vercel CLI ilə:**
```bash
npm i -g vercel
cd auksionu
vercel
```

## 5. Yeni əlavələr

- **Vaxt limiti + "anti-sniping"**: hər lot 25 saniyədir. Son 5 saniyədə yeni təklif gəlsə, vaxt avtomatik 8 saniyəyə qədər uzanır ki, kimsə son anda "sürünərək" udmasın. Saniyə sayğacı 5-dən aşağı düşəndə qırmızı yanıb-sönür.
- **Admin PIN**: otaq yaradanda istəyə bağlı PIN qoya bilərsiniz. Qoysanız, yalnız o PIN-i bilən "Lotu başlat / Satıldı / Sıfırla" kimi idarəetmə əməllərini edə bilər (iştirakçıların qoşulmasına/təklif verməsinə təsir etmir).
- **Səs və vibrasiya**: təklif verəndə, liderliyi itirəndə və lot satılanda telefon qısa səs (Web Audio ilə sintez olunur, xarici fayl lazım deyil) və vibrasiya verir.
- **Nəticə profili**: hər iştirakçının aldığı lotlar avtomatik 5 kateqoriyaya bölünür (Maddi/Status, Zahiri Görünüş, Xarakter, Təməl Dəyərlər, Romantika) və nəticə ekranında faiz zolağı + "profil etiketi" kimi göstərilir (məs: "Status yönümlü — maddi təminata önəm verdi").

## 6. Necə oynanılır

1. Aparıcı `host.html` səhifəsində otaq yaradır (iştirakçı sayını seçir) → 4 rəqəmli **kod** və **link** alır.
2. Bu linki (və ya kodu) iştirakçılara paylaşır — hər kəs öz telefonundan `play.html` açıb kodu daxil edir və adını yazır.
3. Aparıcı "Auksionu başlat" basır → 1-ci lot açılır.
4. İştirakçılar öz ekranlarından "+10 / +50 / +100" düymələri (və ya öz məbləğini) basaraq təklif verir — hamı canlı olaraq qiymətin artdığını görür.
5. Aparıcı "Satıldı!" basanda məbləğ liderin büdcəsindən düşür və növbəti lota keçilir.
6. 10 lot bitəndə aparıcı "Oyunu bitir" basır — hər kəsin ekranında fərdi və ümumi nəticələr (aldığı lotlar + qalan büdcə) görünür. Bu nöqtədə orijinal təlim materialındakı müzakirə suallarını şifahi apara bilərsiniz.
7. "Oyunu sıfırla" ilə eyni otaq kodu ilə yenidən başlaya bilərsiniz.

## 7. Fayl strukturu

Bütün fayllar **eyni səviyyədədir** (qovluqsuz) — GitHub-un veb interfeysinə (Add file → Upload files) faylları sürükləyəndə heç bir qovluq yaratmağa ehtiyac yoxdur, hamısını birbaşa ata bilərsiniz:

```
host.html
index.html
play.html
style.css
api.js
sound.js
analysis.js
host.js
play.js
Code.gs            → bunu GitHub-a yükləməyə bilməzsiniz belə, amma real yeri script.google.com-dur
README.md
vercel.json
```

`Code.gs` reponun içində sadəcə arxiv/istinad üçün saxlanıla bilər — sayt onu heç vaxt yükləmir, çünki o, Google Apps Script-in öz mühitində işləyir (bax: yuxarıdakı 1-ci addım).

## Texniki qeydlər

- Canlılıq **polling** (aparıcı 2 saniyə, iştirakçı 1.5 saniyə) ilə təmin olunur — Google Apps Script websocket dəstəkləmədiyi üçün bu, ən sadə etibarlı üsuldur.
- Eyni anda bir neçə fərqli otaq (fərqli kodlarla) paralel işləyə bilər.
- Bütün oyun vəziyyəti Apps Script-in `PropertiesService`-ində saxlanılır; brauzer yaddaşı (localStorage) istifadə OLUNMUR ki, fərqli telefonlar arasında sinxron qalsın.
