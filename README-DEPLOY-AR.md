# رفع المصحف المديني إلى Vercel وربطه بـAiven

هذا المسار لا يحتاج تنزيل حزم المشروع على Windows؛ Vercel سيثبتها ويبني التطبيق على خوادمه. **لا تشغّل `pnpm install` على جهازك.** مجلد `node_modules` الجزئي الذي حذفته ليس مطلوبًا للنشر.

## قبل الرفع

- تأكد أن كلمة مرور Aiven القديمة تغيّرت وأن `DATABASE_URL` في Vercel يحتوي الجديدة.
- خذ نسخة احتياطية من قاعدة Aiven قبل أول نشر جديد.
- استخدم النسخة المحدّثة من المشروع. ملف `vercel.json` يشغّل فحص اتصال Aiven وترحيلات قاعدة البيانات في Production فقط قبل بناء الموقع؛ إذا فشلت الترحيلات، لا تعاود النشر ولا تحذف سجلات، وأرسل رسالة الخطأ بعد إزالة أي أسرار.
- لا ترفع ملف `.env` أو مجلد `node_modules` إلى GitHub.

## 1. طبّق حزمة إصلاح تسجيل الدخول

1. نزّل أحدث `mushafmadini-username-auth-fix.zip` وفكّه إلى مجلد مؤقت.
2. انسخ المجلدات والملفات الموجودة داخل الأرشيف إلى جذر المشروع `E:\mushafmadini-vercel`، واختر **دمج المجلدات واستبدال الملفات المتكررة**.
3. اترك `.git` وملف `aiven-ca.pem` المحلي دون تغيير. الشهادة وملف `.manus-starter-init.json` مستثنيان الآن من Git حتى لا يُرفع أي منهما بالخطأ.
4. شغّل `powershell -ExecutionPolicy Bypass -File .\scripts\remove-legacy-platform-files.ps1` لإزالة ملفات Manus/OAuth القديمة غير المستخدمة، التي تشير إلى إعدادات Forge أو OAuth لم تعد في النظام. لا يحذف السكربت إعدادات البيئة أو شهادة Aiven أو جداول/سجلات Aiven.

تأكد من استبدال الملفات تحت `client` و`server` و`drizzle`، وإضافة ترحيل `drizzle\0005_disable_legacy_recovery_codes.sql`. يوجد الترحيل السابق `0004` عندك من الحزمة الأولى.

## 2. اعرف مستودع GitHub والفرع الإنتاجي

1. افتح مشروعك الحالي في Vercel.
2. ادخل **Settings → Git**.
3. سجّل اسم مستودع GitHub المتصل واسم **Production Branch**. لا تنشئ مشروع Vercel جديدًا.

افتح PowerShell في `E:\mushafmadini-vercel` ونفّذ:

```powershell
git status --short
git remote -v
git branch --show-current
```

### إذا ظهر المستودع والـremote

تأكد أن الفرع الحالي هو نفسه **Production Branch** في Vercel. إذا كان الاسم مختلفًا، لا تبدّل الفرع ولا تدفع الملفات؛ أرسل لي اسم الفرع الحالي واسم Production Branch قبل المتابعة، حتى لا تضيع تعديلاتك.

### إذا قال Git إن المجلد ليس مستودعًا

استخدم رابط المستودع الذي رأيته في **Vercel → Settings → Git** واستنسخه إلى مجلد جديد:

```powershell
git clone https://github.com/OWNER/REPOSITORY.git E:\mushafmadini-git
```

استبدل `OWNER/REPOSITORY` باسم المستودع الحقيقي. انسخ ملفات النسخة المحدّثة إلى `E:\mushafmadini-git` مع ترك `.git` الموجود هناك، ثم أكمل الأوامر التالية داخل مجلد المستودع الجديد. لا تستخدم `git init` لمجلد منفصل عن المستودع الذي يتصل به Vercel.

## 3. راجع ما سترفعه ثم ادفع التغييرات

داخل مجلد مستودع GitHub الصحيح نفّذ:

```powershell
git status --short
git add -A -- client api server shared drizzle scripts README-DEPLOY-AR.md TODO.md vercel.json
git status --short
```

راجع القائمة قبل المتابعة. يجب ألا ترى `.env` أو `.env.local` أو `node_modules` أو أي ملف يحتوي كلمة مرور أو مفتاحًا. يجب أن يبقى `.env.example` فقط إن ظهر ضمن القائمة.

إذا كانت القائمة سليمة:

```powershell
git commit -m "Switch account login to username and recovery codes"
git push origin BRANCH
```

استبدل `BRANCH` باسم **Production Branch** الذي قرأته في Vercel، مثل `main`؛ لا تكتب كلمة `BRANCH` حرفيًا. لا تحتاج إلى `pnpm install` أو `pnpm build` على Windows.

## 4. تأكد من إعدادات Vercel

المتغيرات التالية يجب أن تكون محفوظة في المشروع الصحيح ضمن **Production**:

- `DATABASE_URL`: رابط Aiven بكلمة المرور الجديدة.
- `MYSQL_SSL_CA`: شهادة CA كاملة.
- `AUTH_JWT_SECRET`: السر العشوائي الذي أنشأته.
- `AUTH_ALLOW_SIGNUP`: `true`.

لا يحتاج هذا الإصدار إلى Gmail أو Resend أو أي متغير بريد. يمكن حذف `RESEND_API_KEY` و`AUTH_EMAIL_FROM` و`PUBLIC_APP_URL` من Vercel بعد نشر الإصدار الجديد؛ لم تعد مستخدمة.

لا ترسل أي قيمة سرية في المحادثة. إذا لم تغيّر **Build Command** في إعدادات Vercel يدويًا، سيقرأ Vercel الأمر من `vercel.json`. إذا كان هناك Build Command مخصص محفوظ في إعدادات اللوحة، اجعله مطابقًا لهذا الأمر حتى تُطبّق المهاجرات قبل البناء:

```bash
pnpm check && if [ "$VERCEL_ENV" = "production" ]; then pnpm db:check && pnpm db:migrate; fi && pnpm build:static
```

وتأكد أن **Install Command** هو:

```bash
pnpm install --frozen-lockfile
```

يمكن اختيار Node.js 22.x في إعدادات البناء إذا ظهر الخيار. تحذير Node.js 24 في جهازك المحلي لا يمنع البناء على Vercel.

## 5. اترك Vercel يبني المشروع

بعد `git push`، افتح **Deployments** في Vercel. سيبدأ نشر Production تلقائيًا:

1. ينزّل Vercel الحزم على خوادمه.
2. يفحص اتصال MySQL/TLS مع Aiven.
3. يطبّق ترحيلات المخطط المسجلة. يضيف `0004` بنية username، ويعطّل `0005` أي رموز استعادة قديمة. لا يحذف أي حساب أو بيانات موقع.
4. يبني الواجهة وينشرها إذا نجحت الخطوات السابقة.

انتظر حتى تصبح الحالة **Ready**. افتح **Build Logs** وتأكد أن فحص Aiven يطبع أسماء الأعمدة والفهارس وأعداد التعارضات فقط؛ لا يطبع كلمات مرور أو رموزًا. ترحيلات `0002` و`0003` و`0004` مصممة للتعافي من فشل جزئي مثل `Duplicate column name`، ويعيد `0005` إبطال الرموز القديمة بأمان. إذا أوقف الفحص البناء بسبب تعارض، لا تضغط **Redeploy** ولا تحذف بيانات؛ أرسل رسالة الخطأ والعدادات الظاهرة فقط، بعد إزالة أي قيمة سرية.

إذا لم يبدأ نشر تلقائي، تأكد أن `git push` كان إلى Production Branch. لا تضغط Redeploy إلى أن نتأكد من أن الكود الجديد وصل للمستودع.

## 6. اختبر الموقع

1. افتح `https://mushafmadini-vercel-3qo2.vercel.app/account`.
2. أنشئ حسابًا جديدًا باسم مستخدم فريد وكلمة مرور لا تقل عن 10 أحرف؛ سيتم تسجيل دخولك مباشرة. لا تظهر رموز أو تُرسل رسائل بريدية. حسابات البريد القديمة لا تُحذف، لكنها لا تتحول تلقائيًا إلى حسابات اسم مستخدم.
3. جرّب الدخول من جهاز ثانٍ باسم المستخدم وكلمة المرور نفسيهما. تسجيل الدخول بهذه البيانات هو طريقة استعادة الوصول على جهاز جديد. إذا نُسيت كلمة المرور نفسها، لا توجد استعادة ذاتية من اسم المستخدم وحده؛ احفظ كلمة المرور في مكان آمن.

بعد نجاح اختبار الموقع الجديد، احذف متغير `MANUS_JWT_SECRET` القديم من Vercel لأنه لم يعد مستخدمًا.
