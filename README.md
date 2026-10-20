# المصحف المديني

نسخة مطورة تحافظ على الواجهة الأصلية وتضيف الأدعية والسبحة ومواقيت الصلاة حسب الموقع والمصحف الكامل وحفظ التفضيلات ومزامنة الحساب. يبدأ النشر من [دليل الإعداد والنشر بالعربية](README-DEPLOY-AR.md). انظر أيضًا [مصادر المحتوى](CONTENT-SOURCES.md) وملف `.env.example`.

الموقع ليس واجهة ثابتة فقط: تشغيل الحسابات والمزامنة على Vercel يحتاج إعداد خدمة المصادقة وقاعدة بيانات MySQL ومتغيرات البيئة الخاصة بك. لا توجد مفاتيح سرية في هذه الحزمة. التذكيرات تعمل أثناء فتح التطبيق فقط، وليست إشعارات خلفية بعد إغلاقه.

## توثيق بنية المشروع الأصلية

React / Express / tRPC / Drizzle starter, adapted from the Sandbox web-db-user template.

- `pnpm dev`: development server; honors `PORT` (default 3000).
- `pnpm build` / `pnpm start`: build and serve `dist/index.js` and `dist/public/`.
- `pnpm db:migrate`: apply checked-in migrations. `pnpm db:push`: generate and apply new schema changes.
- `pnpm check` / `pnpm test`: types and application tests.

Start with the Webdev skill's default-template guide. Platform login, storage, payments and service contracts live in its shared references; read the relevant capability before extending its helper.

`server/_core/publicConfig.ts` exposes only named public runtime values. Private keys stay server-side. The platform serves managed `/manus-storage/` assets; the application does not register a second proxy.

Platform configuration is readable and editable through `webdev.config`. Default settings are initial values, not enforced constraints. The agent may modify the files, commands and configuration or follow the flexible guide for another stack.
