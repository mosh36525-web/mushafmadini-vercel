نسخة كاملة جاهزة لمشروع المصحف المديني

الأرشيف يحتوي ملفات المشروع المصدرية الكاملة، وليس مجلد .git أو node_modules أو dist أو ملفات الأسرار. لا ترفع ملف الشهادة أو أي بيانات اعتماد.

1) نزّل mushafmadini-vercel-ready.zip وفكّه في مجلد مؤقت.
2) خذ نسخة احتياطية من E:\mushafmadini-vercel. انسخ محتويات المجلد المفكوك إلى E:\mushafmadini-vercel واختر دمج المجلدات واستبدال الملفات.
3) مهم: لا تحذف مجلد .git الموجود في المشروع، ولا تستبدله. اترك ملف aiven-ca.pem المحلي كما هو. الأرشيف لا يحتوي أيًا منهما.
4) افتح PowerShell من جذر E:\mushafmadini-vercel ونفّذ سكربت تنظيف الوحدات القديمة:
   powershell -ExecutionPolicy Bypass -File .\scripts\remove-legacy-platform-files.ps1
5) تحقق من شهادة Aiven:
   git check-ignore -v aiven-ca.pem
   يجب أن يعرض قاعدة تجاهل من .gitignore. لا ترفع الشهادة.
6) أضف المشروع إلى Git ثم راجع القائمة:
   git add -A
   git status --short
   إذا ظهر aiven-ca.pem ضمن staged، ألغِ إضافته فورًا:
   git restore --staged aiven-ca.pem
   لا ترفع .env أو أي مفاتيح/كلمات مرور. ملف .env.example النموذجي فقط آمن.
7) ادفع إلى الفرع main:
   git commit -m "Fix project and prepare clean Vercel deployment"
   git push origin main
8) انتظر أحدث Deployment في Vercel حتى يصبح Ready وLatest. افتح Build Logs وتأكد أن pnpm check مرّ دون أخطاء TypeScript قبل البناء.

لا تغيّر DATABASE_URL أو AUTH_JWT_SECRET أو إعدادات Vercel السليمة. لا تشغّل ترحيلات يدويًا؛ Build Command المحدد يطبق الترحيلات تلقائيًا على Production.
