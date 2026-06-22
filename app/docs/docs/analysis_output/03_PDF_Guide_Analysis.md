# تحليل دليل الاستخدام (PDF)
## Latifah_FE_Auto_Planner_Guide.pdf

> تم استخراج النصّ بالكامل آليًا عبر `pypdf`. الملف **نصّي قابل للقراءة 100%** (ليس صورة ممسوحة). لم يُعدَّل الأصل.

---

## 1. هوية الدليل

| الخاصية | القيمة |
|---|---|
| العنوان (Title) | `Latifah's FE Auto-Planner Guide` |
| المُنتِج (Producer) | `Skia/PDF m148` — أي طُبع من صفحة HTML عبر متصفّح (HeadlessChrome / Edge 148) إلى PDF |
| التاريخ | 2026-05-18 (نفس يوم المصنّف) |
| عدد الصفحات | 6 |
| الحجم | ~204 KB |
| اللغة | الإنجليزية |
| الصور/اللقطات (screenshots) | **لا توجد** صور مضمّنة؛ الدليل نصّ + جداول منسّقة فقط |

> كون الدليل والمصنّف صدرا في **اليوم نفسه** وبالعنوان نفسه يؤكّد أنهما **نسخة واحدة متطابقة الإصدار** كتبها المؤلّف ذاته.

---

## 2. ما يقول الدليل إن المخطّط يفعله

> "This is an automatic adaptive study planner. You do not type tasks. You do not build a weekly plan. You only edit yellow cells. Everything else updates by itself."

القاعدة الذهبية (30 ثانية):
- **Yellow cells** = تُحرّرها (مدخلات وقوائم منسدلة).
- **Green cells** = يملؤها المصنّف؛ لا تكتب فيها.
- "اقرأ Dashboard، استخدم Weekly Plan، وهذا كل شيء".

---

## 3. شرح الأوراق الثلاث (كما في الدليل)

**1) Dashboard** (افتحها أولًا كل يوم):
- صفّ بطاقات علوي: Exam Date, Days Remaining, Weeks Remaining, Progress %, Readiness Score, Next Best Topic.
- صفّ بطاقات ثانٍ: Completed Hours, Remaining Hours, Weekly Available, Weekly Planned, High-Priority Remaining, This Week (X/7 done).
- الصندوق الأحمر "What Should I Study Next?": Today's Auto-Topic/Auto-Task/Mode+Length, Next Best Topic Overall, Why this topic, Low-Energy Backup.
- ثلاث لوحات: **Essential Inputs** (name, exam date, start date, study style, weekly hour bounds)، **Daily Availability** (Min/Energy/Mode لكل يوم — "Drives the planner")، **Weekly Plan Preview** (للقراءة فقط).
- أسفلها 4 رسوم + مرجع Study Modes.

**2) Topic Planner** (مركز التحكّم بالمحتوى): يذكر الدليل أنك **تحرّر 6 أعمدة فقط**: Include?, Confidence, Boredom (optional), Completed Hours, Status, Notes. والبقية (Priority Score, Progress %, Next Action) محسوبة. ويشرح جدول `Next Action`:
- `Skip for Now` (No)، `Defer` (Later)، `Keep Warm` (100% أو Exam Ready)، `Study Next` (≥6)، `Study This Week` (≥4.5)، `Practice` (≥3)، `Review` (الباقي).

**3) Weekly Plan** (تتولّد آليًا): 7 صفوف تملأ نفسها؛ تحرّر 3 أعمدة فقط: Done?, Actual Min, Notes. أسفلها: **Week Capacity & Health** (Available/Planned/Done/Status) و**Weekly Reflection** (4 أسئلة سبت).

---

## 4. تعليمات الإعداد والاستخدام (Setup & Usage)

**سير العمل الأسبوعي:**
1. **مساء الأحد (5 دقائق):** افتح Dashboard، اضبط Min/Energy/Mode للأيام السبعة القادمة حسب واقع حياتك.
2. **الإثنين–السبت (كل يوم مذاكرة):** افتح Dashboard، اقرأ "What Should I Study Next?"، افتح Weekly Plan وابحث عن صفّ اليوم، ذاكر المهمة للمدة المقترحة، علّم Done? واملأ Actual Min.
3. **بعد المذاكرة:** إن أنجزت ساعات على موضوع، اذهب إلى Topic Planner وأضِفها إلى Completed Hours وحدّث Status.
4. **نهاية الأسبوع:** املأ أسئلة المراجعة الأربعة، واضبط أنماط الأسبوع التالي.

**جدول "ما الذي يُعاد حسابه عند التغيير":** يربط كل تغيير بنتيجته (Exam Date → Days/Weeks Remaining + readiness math، Daily Mode → موضوع/مهمة/دقائق اليوم، Confidence → Priority، Include? → مضاعِف الأولوية، Status=Exam Ready → 10%، Status=Skipped → 0، Completed=كامل → 100% + 10%، Done?=Yes → عدّاد This Week، Actual Min → Done Hours).

**قواعد الأنماط (Modes):** Normal 25–45د (أعلى أولوية، مفهوم + 2–4 أمثلة)، Low Energy 10–20د (مهمة عامة خفيفة)، Family 20–45د (مراجعة Tier 2/3 خفيفة)، Rest 0.

**آلية اختيار المواضيع (نصّ الدليل):**
- "Normal days rotate through the top-priority Tier 1 / Tier 2 topics, never repeating the same topic twice in the same week."
- "Family days pick the lightest Tier 2 / Tier 3 topic – never Tier 1."
- "Low Energy days rotate through 6 backup tasks."
- "Rest days show 'Rest. No study required.'"

**ورقة الغش للتوافر اليومي (Daily Availability cheat sheet):** Sun Normal 30/2، Mon Normal 35/3، Tue Normal 30/2، Wed Normal 35/3، Thu Low Energy 25/2، Fri Family 30/3، Sat Family 45/4.

**تحديث Completed Hours:** "أضِف دقائق/60. مثال: 35 دقيقة على 6.6 Impedance ⇒ أضِف 0.58 (أو قرّبها إلى 0.5)."

---

## 5. الافتراضات والقيود وحلّ المشكلات

**الافتراضات:** أن تاريخ نظام Windows صحيح (لأن الأسبوع يُحسب من `TODAY()` ويبدأ الأحد)؛ وأن المستخدم سيحدّث `Completed/Status` يدويًا بأمانة.

**ماذا تفعل لو بدت الخطة محمّلة زيادة؟** افحص Capacity Status: Balanced (تابع)، Under capacity (المتاح < 3 ساعات ⇒ ركّز على Tier 1)، Over capacity (حوّل يوم Normal إلى Family، أو يومًا إلى Rest، أو قلّل الدقائق).

**ماذا تؤجّل أولًا؟** (1) Tier 3 عالي الملل ومنخفض الثقة — "Section 11 Electromagnetics is the #1 candidate"، (2) Tier 2 صعب ومنخفض المكسب — "7.3 Laplace، 8.3 Digital Filters & Z-Transforms"، (3) ما حالته Strong/Exam Ready. **"Never postpone Tier 1"** ويُعدّد أقسام Tier 1.

**حلّ المشكلات (Troubleshooting):**
- يوم يظهر "No included topics. Update Topic Planner." ⇒ كل مواضيع Tier 1 صارت 100%/Exam Ready أو ليست Yes.
- الرسوم تبدو فارغة ⇒ طبيعي في البداية، تمتلئ بعد إدخال Status/Completed.
- "Weekly Plan shows the wrong week" ⇒ الأسبوع يُحسب من `TODAY()` ويبدأ الأحد.

**ما هو غير موجود (عمدًا):** لا بنك أسئلة، لا نسخ/لصق، **لا عربية**، لا كتابة مهام يدوية، لا اختيار يدوي للمواضيع في Weekly Plan.

---

## 6. تقييم جودة الدليل

**نقاط القوة:**
- **دقيق ومطابق للإصدار** بدرجة لافتة؛ يصف نفس أسماء الأوراق والبطاقات والأعمدة الموجودة فعلًا.
- يشرح **منطق الأولوية والإجراءات وعتباتها** بدقّة تطابق الصيغ.
- ورقة الغش للتوافر **تطابق القيم الافتراضية في المصنّف حرفيًا**.
- ادّعاءات الـ Tiers (أقسام Tier 1، ومرشّحو التأجيل في Tier 3/2) **صحيحة 100%** بمقارنتها بعمود `F`.
- أسلوب عملي مختصر وموجّه لغير التقني.

**نقاط ضعف/نواقص الدليل (تفصيلها في تقرير 04):**
1. يوحي بأن **كل "Essential Inputs" مؤثّرة** (name, start date, study style, weekly bounds) بينما **خمسة منها لا تُستعمل**.
2. يقول إن Exam Date يؤثّر في "**all readiness math**"، وهذا **غير صحيح** (لا أثر له على الجاهزية ولا على الخطة).
3. يصف اختيار أيام Normal بأنه "Tier 1/Tier 2 فقط"، بينما المحرّك يرتّب **كل الـ Tiers** بالأولوية (تبسيط).
4. **لا يذكر** وجود الأوراق المخفية الثلاث ولا أنه يجب عدم حذفها/تعديلها.
5. **لا يذكر** غياب الحماية، ولا أن الخطة **أسبوع واحد متجدّد** فقط (لا جدول كامل للامتحان).
6. **لا يوضّح** أن `Done?`/`Actual Min` لا تُحفظ كسجلّ أسبوعي (تتغيّر مع تغيّر الأسبوع).
7. **خالٍ من لقطات الشاشة**، رغم أنه دليل لمستخدم غير تقني (نصّ فقط).
