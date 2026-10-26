تحديث المصحف المديني — المراجعة الموحدة وواجهة 3D

محتوى التحديث
- صفحة مراجعة واحدة فيها ثلاثة تبويبات: مراجعة يدوية، تسميع ذكي محلي، واختبارات الحفظ.
- اختبارات الحفظ تتضمن التسميع العشوائي، إكمال الآية، واختيار الآية التالية.
- أُبقي رابط /manual-review-test القديم صالحًا، لكنه يفتح صفحة المراجعة نفسها على تبويب الاختبارات.
- إضافة مجسم مصحف ثلاثي الأبعاد بـ CSS فقط، دون إضافة مكتبات أو إرسال الصوت إلى الخادم.
- نموذج التسميع يُحمّل عند دخول الموقع، ثم تتم معالجة الصوت محليًا داخل المتصفح. تنزيل النموذج أول مرة يقارب 45 ميغابايت.

التطبيق على Windows PowerShell
1. أغلق خادم التطوير إن كان يعمل، ثم فك ضغط هذا الملف فوق نسخة المشروع الموجودة على قرص NTFS مثل C:، وليس على E: بنظام FAT32.
2. عدّل مسار المشروع إذا كان اسم مجلدك مختلفًا:

$Project = Join-Path $env:USERPROFILE "mushafmadini-vercel-ntfs"
$Zip = Join-Path $env:USERPROFILE "Downloads\mushafmadini-unified-review-3d.zip"
Expand-Archive -LiteralPath $Zip -DestinationPath $Project -Force
Set-Location $Project

3. تأكد أن Node.js هو الإصدار 22، ثم ثبّت الحزم وابنِ المشروع:

node -v
pnpm --version
pnpm install --frozen-lockfile --fetch-timeout=300000 --fetch-retries=5 --network-concurrency=4
pnpm check
pnpm test
pnpm build:static

يجب أن ترى 47 اختبارًا ناجحًا وأن ينتهي البناء بعلامة النجاح. تحذيرات Vite عن حجم الحزمة أو إعداد optimizeDeps لا تمنع نجاح البناء إذا انتهى الأمر برسالة نجاح.

رفع التعديلات إلى GitHub
راجع الملفات المتغيرة أولًا:

git status --short

إذا كانت القائمة تشمل تغييرات المشروع المقصودة فقط، أضف الملفات والملفات الجديدة:

git add -A
git diff --cached --check
git diff --cached --stat
git commit -m "Unify Quran review and add 3D review workspace"
git push origin main

إذا كان في القائمة ملف أسرار مثل .env، لا تضفه إلى Git. بعد نجاح الدفع، سيبدأ Vercel النشر تلقائيًا إذا كان المشروع مربوطًا بفرع main. افتح صفحة Deployments في Vercel وتأكد أن أحدث نشر بحالة Ready.
