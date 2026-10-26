تحديث المصحف المديني — مراجعة موحّدة وتجربة 3D

ما الجديد
- صفحة مراجعة موحّدة فيها مراجعة يدوية، تسميع ذكي محلي، واختبارات الحفظ: التسميع العشوائي، إكمال الآية، واختيار الآية التالية.
- رابط /manual-review-test القديم يفتح الصفحة الموحّدة على تبويب الاختبارات.
- مشهد رئيسي إجرائي بـ Three.js: مصحف مفتوح، قبّة ومئذنتان، نجمة ثمانية، شعاع ذهبي، مدار متقطع ونقاط تفاعلية للورد والصلاة والسكينة.
- Three.js يُحمّل عند اقتراب المشهد من الشاشة؛ والرسم الثابت client/public/images/mushaf-3d-fallback.svg يبقى ظاهرًا في أثناء التحميل أو عند تعذّر WebGL. لا توجد نماذج أو خامات محمية بحقوق.
- سقف دقة العرض ضعفي دقة الشاشة، والمجسّمات منخفضة التفاصيل، وتتوقف الحركة عند تفضيل تقليل الحركة أو عندما يكون المشهد خارج الشاشة. الحركة عبر المؤشر/اللمس؛ وإمالة الجهاز اختيارية من زر واضح.
- بطاقات الورد والصلاة والأذكار لها إمالة 3D طفيفة على الشاشات ذات المؤشر، وتظهر الآيات بحركة انتقال هادئة عند تبديل مجموعة القراءة.
- لم تتغير بيانات المصحف أو نصوص الآيات. معالجة صوت التسميع تبقى محلية داخل المتصفح؛ تنزيل نموذج الصوت عند أول زيارة يقارب 45 ميغابايت.

التطبيق على Windows PowerShell
1. أغلق خادم التطوير إن كان يعمل. فك الضغط فوق نسخة المشروع على قرص NTFS مثل C: وليس E: بنظام FAT32.
2. عدّل المسارات إن كان اسم المجلد مختلفًا:

$Project = Join-Path $env:USERPROFILE "mushafmadini-vercel-ntfs"
$Zip = Join-Path $env:USERPROFILE "Downloads\mushafmadini-unified-review-3d.zip"
Expand-Archive -LiteralPath $Zip -DestinationPath $Project -Force
Set-Location $Project

3. تأكد أن Node.js إصدار 22 وpnpm متوفران، ثم شغّل:

node -v
pnpm --version
pnpm install --frozen-lockfile --fetch-timeout=300000 --fetch-retries=5 --network-concurrency=4
pnpm check
pnpm test
pnpm build:static

المتوقع نجاح فحص TypeScript والاختبارات الـ47 والبناء. التحذير الخاص بحجم بعض chunks أو إعداد optimizeDeps تحذير Vite؛ Three.js محفوظ في ملف منفصل يُحمّل عند الحاجة.

رفع إلى GitHub ثم النشر في Vercel
راجع القائمة قبل الرفع، ولا تضف ملفات أسرار مثل .env:

git status --short
git add -A
git diff --cached --check
git diff --cached --stat
git commit -m "Add immersive Three.js Quran home scene"
git push origin main

إذا كان مستودع GitHub مربوطًا بفرع Vercel الإنتاجي main فسيبدأ النشر تلقائيًا بعد الدفع. افتح Deployments في Vercel وانتظر Ready، ثم حدّث الموقع المنشور تحديثًا قويًا Ctrl+F5.
