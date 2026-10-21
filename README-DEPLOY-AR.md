# رفع المصحف المديني إلى Vercel وربطه بـAiven وResend

هذا المسار لا يحتاج تنزيل حزم المشروع على Windows؛ Vercel سيثبتها ويبني التطبيق على خوادمه. **لا تشغّل `pnpm install` على جهازك.** مجلد `node_modules` الجزئي الذي حذفته ليس مطلوبًا للنشر.

## قبل الرفع

- تأكد أن كلمة مرور Aiven القديمة تغيّرت وأن `DATABASE_URL` في Vercel يحتوي الجديدة.
- خذ نسخة احتياطية من قاعدة Aiven قبل أول نشر جديد.
- استخدم النسخة المحدّثة من المشروع. ملف `vercel.json` يشغّل فحص اتصال Aiven وترحيلات قاعدة البيانات في Production فقط قبل بناء الموقع؛ إذا فشلت الترحيلات، لا تعاود النشر ولا تحذف سجلات، وأرسل رسالة الخطأ بعد إزالة أي أسرار.
- لا ترفع ملف `.env` أو مفاتيح Resend أو مجلد `node_modules` إلى GitHub.

## 1. استبدل ملفات المشروع بالنسخة المحدّثة

1. نزّل أرشيف ZIP المحدّث وفكّه إلى مجلد مؤقت، مثل `E:\mushaf-update`.
2. افتح المجلد الداخلي `mushafmadini-vercel`.
3. انسخ **محتوياته** إلى `E:\mushafmadini-vercel` الذي تعمل منه الآن، واختر دمج المجلدات واستبدال الملفات المتكررة.
4. إذا كان في مجلدك الحالي مجلد `.git`، اتركه كما هو. الأرشيف المحدّث لا يحتوي `.git`.
5. لا تنسخ `.env` أو `node_modules`، إن وُجدا في المجلد المؤقت.

تأكد أن الملفات التالية موجودة مباشرة في `E:\mushafmadini-vercel`:

```text
package.json
pnpm-lock.yaml
vercel.json
aiven-ca.pem
api\index.ts
```

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
git add -A
git status --short
```

راجع القائمة قبل المتابعة. يجب ألا ترى `.env` أو `.env.local` أو `node_modules` أو أي ملف يحتوي كلمة مرور أو مفتاحًا. يجب أن يبقى `.env.example` فقط إن ظهر ضمن القائمة.

إذا كانت القائمة سليمة:

```powershell
git commit -m "Enable email login and password reset"
git push origin BRANCH
```

استبدل `BRANCH` باسم **Production Branch** الذي قرأته في Vercel، مثل `main`؛ لا تكتب كلمة `BRANCH` حرفيًا. لا تحتاج إلى `pnpm install` أو `pnpm build` على Windows.

## 4. تأكد من إعدادات Vercel

المتغيرات التالية يجب أن تكون محفوظة في المشروع الصحيح ضمن **Production**:

- `DATABASE_URL`: رابط Aiven بكلمة المرور الجديدة.
- `MYSQL_SSL_CA`: شهادة CA كاملة.
- `AUTH_JWT_SECRET`: السر العشوائي الذي أنشأته.
- `AUTH_ALLOW_SIGNUP`: `true`.
- `RESEND_API_KEY`: مفتاح Resend الكامل، كـSecret.
- `AUTH_EMAIL_FROM`: `Mushaf Madini <onboarding@resend.dev>`.
- `PUBLIC_APP_URL`: `https://mushafmadini-vercel-3qo2.vercel.app`.

لا ترسل أي قيمة سرية في المحادثة. إذا لم تغيّر **Build Command** في إعدادات Vercel يدويًا، سيقرأ Vercel الأمر من `vercel.json`. إذا كان هناك Build Command مخصص محفوظ في إعدادات اللوحة، اجعله مطابقًا لهذا الأمر حتى تُطبّق المهاجرات قبل البناء:

```bash
if [ "$VERCEL_ENV" = "production" ]; then pnpm db:check && pnpm db:migrate; fi && pnpm build:static
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
3. يطبّق ترحيلات المخطط المسجلة، ومنها حقول الحساب ورموز استعادة كلمة المرور. هذه التغييرات تضيف بنية، ولا تتضمن حذف الجداول أو السجلات.
4. يبني الواجهة وينشرها إذا نجحت الخطوات السابقة.

انتظر حتى تصبح الحالة **Ready**. افتح **Build Logs** وتأكد أن سطري فحص Aiven والترحيلات ظهرا قبل نجاح البناء. إذا فشل البناء عند الترحيل، لا تضغط **Redeploy** ولا تحذف بيانات؛ أرسل آخر رسالة خطأ فقط بعد إزالة أي قيمة سرية. قد يكون السبب قيد بريد مكرر أو اختلاف حالة المخطط.

إذا لم يبدأ نشر تلقائي، تأكد أن `git push` كان إلى Production Branch. لا تضغط Redeploy إلى أن نتأكد من أن الكود الجديد وصل للمستودع.

## 6. اختبر الموقع

1. افتح `https://mushafmadini-vercel-3qo2.vercel.app/account`.
2. أنشئ حسابًا ببريدك وكلمة مرور لا تقل عن 10 أحرف، ثم جرّب تسجيل الخروج والدخول. الدخول يعتمد على Aiven ولا يحتاج Resend.
3. لاختبار **نسيت كلمة المرور**، يجب أن يكون البريد المستخدم للموقع هو نفسه البريد المرتبط بحساب Resend؛ المرسل التجريبي لا يرسل إلى بقية الزوار.
4. افتح رابط الاستعادة خلال 30 دقيقة. هو صالح مرة واحدة، وبعد تغيير كلمة المرور تُبطَل الجلسات السابقة.

لإرسال رسائل الاستعادة إلى كل مستخدمي الموقع مستقبلًا، يلزم توثيق نطاق تملكه في Resend أو استخدام مزود إرسال آخر. بعد نجاح اختبار الموقع الجديد، احذف متغير `MANUS_JWT_SECRET` القديم من Vercel لأنه لم يعد مستخدمًا.
