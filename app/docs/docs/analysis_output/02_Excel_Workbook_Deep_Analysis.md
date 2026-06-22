# التحليل التقني العميق لملف Excel
## Latifah_FE_Auto_Generated_Study_Planner.xlsx

> تقرير تقني مفصّل. اللغة عربية مع الإبقاء على المصطلحات التقنية بالإنجليزية. جميع الأمثلة مأخوذة فعليًا من الملف عبر الفحص البرمجي باستخدام `openpyxl`. **لم يتم تعديل الملف الأصلي**؛ تمّ العمل على نسخة فقط.

---

## 0. منهجية الفحص

- تم نسخ الملف الأصلي إلى نسخة عمل (`wb_copy.xlsx`) وفحصها فقط، دون أي تعديل على الأصل.
- تم فتح الملف بطريقتين عبر `openpyxl 3.1.5`:
  - `data_only=False` لقراءة **الصيغ (formulas)** كنص.
  - `data_only=True` لقراءة **القيم المخزّنة (cached values)**.
- تم فكّ ضغط حاوية OOXML (الـ `.xlsx` هو في الأصل ملف ZIP) لفحص الأجزاء الداخلية: `workbook.xml`، `worksheets/*.xml`، `sharedStrings.xml`، `styles.xml`، `calcChain.xml`، `docProps/*`، والعلاقات `_rels`.
- تم البحث عن: macros / VBA، Power Query، External Links، Pivot Tables، Form Controls، Tables (ListObjects).

---

## 1. هوية الملف وميتاداتا (Metadata)

| الخاصية | القيمة |
|---|---|
| اسم الملف | `Latifah_FE_Auto_Generated_Study_Planner.xlsx` |
| الحجم | 53,769 بايت (~53 KB) |
| `creator` | `openpyxl` (تولّد أوليًا عبر سكربت) |
| `lastModifiedBy` | `Abdul Rahim Abu Riyala` (فُتح وحُفظ في Microsoft Excel) |
| `created` / `modified` | 2026-05-18 |
| `Application` | Microsoft Excel (AppVersion 16.0300) |
| مسار أصلي مضمّن (absPath) | `E:\FE\Roadmap\` |
| موضوع المخطّط | مخطّط مذاكرة لامتحان **FE (Fundamentals of Engineering) – Electrical & Computer** |

**ملاحظة:** تركيبة "أنشأه openpyxl ثم عدّله شخص في Excel" تدل على أن الملف **مُولَّد آليًا ببرنامج بايثون** ثم رُوجِع يدويًا. هذا يفسّر اسمه "Auto-Generated".

---

## 2. الأتمتة والمحتوى الخاص (فحص حاسم)

تم فحص حاوية OOXML جزءًا جزءًا، والنتيجة قاطعة:

| العنصر | موجود؟ | ملاحظة |
|---|:--:|---|
| VBA / Macros (`xl/vbaProject.bin`) | ❌ لا | الملف بصيغة `.xlsx` وليس `.xlsm`، ولا يحتوي أي ماكرو |
| Office Scripts / `customXml` | ❌ لا | — |
| Power Query / `connections.xml` / DataMashup | ❌ لا | لا اتصالات بيانات |
| External Links (`xl/externalLinks/`) | ❌ لا | لا روابط لملفات خارجية |
| Pivot Tables / Pivot Cache | ❌ لا | — |
| Query Tables | ❌ لا | — |
| Form Controls / ActiveX | ❌ لا | لا أزرار (buttons) فعلية في الملف |
| Slicers | ❌ لا | — |
| Excel Tables (ListObjects) | ❌ لا | يعتمد على **Named Ranges + AutoFilter** بدلًا منها |
| Charts | ✅ نعم | 4 رسوم بيانية في `Dashboard` |
| Drawings | ✅ نعم | `drawing1.xml` (حاوية الرسوم) |
| Shared Strings / Calc Chain | ✅ نعم | طبيعي |
| Comments / Threaded comments | ❌ لا | لا تعليقات |

**خلاصة صريحة كما طُلب:** **لا يحتوي المصنّف على أي Macros أو VBA أو Office Scripts أو Power Query أو روابط خارجية.** كل المنطق (logic) مبنيّ بالكامل على **صيغ Excel أصيلة (native formulas) + Named Ranges + Conditional Formatting + Data Validation**. هذا يجعله آمنًا (لا كود تنفيذي) لكنه يعني أيضًا أن كل "الذكاء" موجود في الصيغ.

---

## 3. بنية المصنّف (Workbook Structure)

عدد الأوراق: **6 أوراق** — 3 ظاهرة (visible) و3 مخفية (hidden). لا توجد أوراق "very hidden".

| # | الورقة | الحالة | الدور الوظيفي | عدد الصيغ | Data Validation | Conditional Formatting | Merged Cells |
|:-:|---|:--:|---|:--:|:--:|:--:|:--:|
| 1 | `Dashboard` | visible | لوحة المعلومات + مدخلات أساسية + التوافر اليومي + الرسوم | 54 | 3 | 16 | 100 |
| 2 | `Topic Planner` | visible | جدول 85 موضوعًا + **محرّك الأولوية (Priority engine)** | 595 | 4 | 10 | 0 |
| 3 | `Weekly Plan` | visible | مخرجات الخطة الأسبوعية (7 أيام) + متابعة | 56 | 1 | 8 | 21 |
| 4 | `_Lists` | hidden | قوائم منسدلة + قوالب المهام | 0 | 0 | 0 | 0 |
| 5 | `_Calc` | hidden | تجميعات (aggregations) + Top 5 + مصادر الرسوم | 39 | 0 | 0 | 0 |
| 6 | `_PlanEngine` | hidden | **محرّك توليد خطة الـ 7 أيام** | 112 | 0 | 0 | 0 |

**الإجمالي:** 856 صيغة، 8 نطاقات Data Validation، 34 قاعدة Conditional Formatting، **0 خلية خطأ** (لا `#REF!`/`#VALUE!`/`#DIV/0!`/`#N/A`).

### 3.1 الأوراق المخفية
الأوراق `_Lists` و`_Calc` و`_PlanEngine` مخفية بحالة `hidden` (وليست `veryHidden`)، أي **يمكن لأي مستخدم إظهارها بسهولة** عبر النقر بزر الفأرة الأيمن > Unhide. وهي قلب المنطق الحسابي للمخطّط.

### 3.2 الحماية (Protection)
- **لا توجد أي حماية على مستوى المصنّف** (`lockStructure` غير مُفعّل، لا كلمة مرور).
- **لا توجد حماية على أي ورقة** (`sheet protection = False` في الأوراق الستّ كلها).
- النتيجة: كل الخلايا — بما فيها الصيغ الحسّاسة وأوراق المحرّك المخفية — **قابلة للتعديل أو الحذف دون أي مانع**. (انظر تقرير المخاطر 05.)

### 3.3 التجميد والعرض (Freeze Panes / AutoFilter)
- `Dashboard`: تجميد عند `A4`. `Topic Planner`: تجميد عند `H2`. `Weekly Plan`: تجميد عند `A6`.
- يوجد AutoFilter مخفي على `Topic Planner` بالنطاق `A1:R86` (معرّف باسم `_xlnm._FilterDatabase`).
- العمود `S` مخفي في `Topic Planner` (عمود مساعد). الأعمدة `T` و`U` و`V` **ظاهرة وبدون عناوين** (انظر 5.4).

---

## 4. سير عمل المستخدم (User Workflow) كما هو مُنفّذ فعليًا

### 4.1 المدخلات (Inputs) — الخلايا الصفراء `FFF2CC`
المخطّط يعتمد قاعدة لونية مُطبّقة فعليًا: **الأصفر = مدخلات تُحرّر، الأخضر `E2EFDA` = مخرجات محسوبة لا تُلمَس**.

**أ) في `Dashboard`:**
| الخلية | الحقل | مستخدَم في صيغة؟ |
|---|---|:--:|
| `C20` | Student Name | ❌ **لا** (لا يُستعمل في أي صيغة؛ العنوان `A1` نصّ ثابت) |
| `C21` | Exam Date | ✅ نعم (للعدّاد فقط) |
| `C22` | Start Date | ❌ **لا** |
| `C23` | Study Style (Flexible/Daily/Non-Daily) | ❌ **لا** |
| `C24` | Min Weekly Hours | ❌ **لا** |
| `C25` | Max Weekly Hours | ❌ **لا** |
| `G20:G26` | Daily Minutes (7 أيام) | ✅ نعم → `DailyMins` |
| `H20:H26` | Daily Energy (1–5) | ✅ نعم → `DailyEnergy` |
| `I20:I26` | Daily Mode (Normal/Low Energy/Family/Rest) | ✅ نعم → `DailyMode` |

> **نتيجة مهمة:** من بين 6 "مدخلات أساسية" في لوحة Essential Inputs، **خمسة منها (Name, Start Date, Study Style, Min/Max Weekly Hrs) لا تؤثّر في أي حساب**؛ المؤثّر الوحيد هو `Exam Date` (ولِعدّاد الأيام فقط، لا للخطة). أي أنها **حقول ميتة (dead inputs)**.

**ب) في `Topic Planner`** — المدخلات الصفراء الفعلية هي 6 أعمدة فقط:
`A` Include? (Yes/No/Later)، `G` Confidence (1–5)، `I` Boredom (1–5)، `N` Completed Hrs، `P` Status، `R` Notes.

> لكن الأعمدة `H` Difficulty و`J` Quick Win **تحملان أيضًا قوائم منسدلة (1–5) وتؤثّران مباشرة في درجة الأولوية** رغم أنهما غير ملوّنتين بالأصفر؛ والأعمدة `E` Avg Wt و`F` Tier و`M` Suggested Hrs قابلة للتعديل بحرّية (لا حماية). أي أن "المدخلات الحقيقية" أوسع مما توحي به الألوان.

**ج) في `Weekly Plan`** — المدخلات الصفراء: `H` Done? (Yes/No/Skipped)، `I` Actual Min، `J` Notes.

### 4.2 ما يحسبه المصنّف تلقائيًا
1. **درجة الأولوية** لكل موضوع (`Topic Planner!K`).
2. **الإجراء التالي** لكل موضوع (`Topic Planner!Q`).
3. **التجميعات** (ساعات، حالات، Top 5، تقدّم، جاهزية) في `_Calc`.
4. **خطة 7 أيام** كاملة في `_PlanEngine` (الموضوع/المهمة/المدة لكل يوم).
5. **عرض الخطة** في `Weekly Plan` و`Dashboard` (بطاقات + رسوم).

### 4.3 طريقة التحديث عبر الزمن
- المستخدم يحدّث `Completed Hrs` و`Status` و`Confidence` في `Topic Planner` بعد كل جلسة.
- يحدّث `Done?` و`Actual Min` في `Weekly Plan`.
- يعدّل `Daily Availability` (الدقائق/الطاقة/النمط) أسبوعيًا في `Dashboard`.
- الخطة **تتجدّد تلقائيًا** لأن المحرّك يعيد الحساب من `TODAY()`. (لكنها خطة **أسبوع واحد متجدّد فقط**، لا جدول كامل حتى الامتحان — انظر قسم المنطق.)

---

## 5. تحليل الصيغ (Formula Analysis)

إجمالي 856 صيغة. أهمها مُجمَّعة حسب الورقة. وُجدت دالة **متطايرة (volatile)** واحدة فقط: `TODAY()` بـ 7 مواضع. **لا وجود** لـ `NOW`/`INDIRECT`/`OFFSET`/`RAND`/`RANDBETWEEN`. هذا ممتاز من ناحية الأداء والاستقرار.

### 5.1 قلب المحرّك: درجة الأولوية (`Topic Planner!K2`)
```
=IF(A2="No",0,
   IF(P2="Skipped",0,
     ROUND( ( E2*0.35 + (6-G2)*0.25 + J2*0.2
              + IF(F2=1,5,IF(F2=2,3,1))*0.15
              - I2*0.05 )
            * IF(A2="Later",0.5,1)
            * IF(OR(IFERROR(N2/M2,0)>=1, P2="Exam Ready"), 0.1, 1)
          ,2)))
```
**ماذا تفعل:** تحسب درجة من مزيج موزون: وزن الامتحان `E×0.35` + فجوة الثقة `(6-Confidence)×0.25` + المكسب السريع `QuickWin×0.2` + مكافأة الـ Tier (`5/3/1`)×0.15 − عقوبة الملل `Boredom×0.05`. ثم تُضرب في 0.5 إذا كان `Later`، وفي 0.1 إذا اكتمل الموضوع أو صار `Exam Ready`، وتصبح 0 إذا `No` أو `Skipped`.
**نقاط القوة:** محميّة من القسمة على صفر عبر `IFERROR(N2/M2,0)`. منطق واضح وقابل للتفسير.

### 5.2 الإجراء التالي (`Topic Planner!Q2`)
```
=IF(A2="No","Skip for Now",
  IF(A2="Later","Defer",
   IF(OR(O2>=1,P2="Exam Ready"),"Keep Warm",
    IF(P2="Skipped","Skip for Now",
     IF(K2>=6,"Study Next",
      IF(K2>=4.5,"Study This Week",
       IF(K2>=3,"Practice","Review")))))))
```
تترجم درجة الأولوية إلى توصية نصّية. عتبات: `≥6 Study Next`، `≥4.5 Study This Week`، `≥3 Practice`، وإلا `Review`.

### 5.3 نسبة التقدّم (`Topic Planner!O2`)
```
=IFERROR(MIN(N2/M2,1),0)
```
نسبة الإنجاز للموضوع = Completed/Suggested بحدّ أقصى 100%، محميّة من الأخطاء.

### 5.4 الأعمدة المساعدة (Helper keys) `S:V` في `Topic Planner`
| العمود | الاسم (Named Range) | الصيغة (الصف 2) | مستخدَم؟ | ظاهر؟ |
|:-:|---|---|:--:|:--:|
| `S` | `PriorityKey` | `=K2+ROW()/100000` | ✅ (52 مرة) | مخفي |
| `T` | `TiredKey` | `=IF(A2="No",0,IF(P2="Skipped",0,(J2*2-H2-I2+5)*IF(O2>=1,0.1,1)))+ROW()/100000` | ❌ **غير مستخدم** | **ظاهر** |
| `U` | `DeferKey` | `=IF(A2="Yes",10-K2,0)+ROW()/100000` | ❌ **غير مستخدم** | **ظاهر** |
| `V` | `FamilyKey` | `=IF(A2="No",0,IF(P2="Skipped",0,IF(F2=1,0,IF(O2>=1,0,(J2*2-H2-I2+5)*0.5+(6-G2)*0.3))))+ROW()/100000` | ✅ (14 مرة) | **ظاهر** |

**حيلة ذكية:** إضافة `ROW()/100000` تجعل كل مفتاح **فريدًا** حتى لو تساوت الدرجات، فتعمل `LARGE`+`MATCH` دون تضارب (وهذا سبب عدم ظهور `#N/A`). 
**لكن:** `TiredKey` و`DeferKey` **يُحسبان لكل الصفوف (170 صيغة) ولا يُستعملان مطلقًا**؛ وعمودا `T`/`U`/`V` ظاهرة وبلا عناوين (الخلايا `T1:V1` فارغة) فتظهر للمستخدم أرقام غامضة مثل `9.00002`.

### 5.5 محرّك الخطة (`_PlanEngine`, 7 صفوف = 7 أيام)
- **مرساة التاريخ** (`B2`): `=TODAY()-WEEKDAY(TODAY(),1)+1` ⇒ أحد الأسبوع الحالي، ثم `B3=B2+1` ... (أسبوع يبدأ الأحد).
- **عدّادات الرتب** (`G`/`H`/`I`): تعدّ تراكميًا أيام Normal / Low Energy / Family.
- **اختيار الموضوع** (`J` = TopicIdx):
```
=IF(D2="Rest",0,
  IF(D2="Low Energy",0,
   IF(D2="Family", IFERROR(MATCH(LARGE(FamilyKey,I2),FamilyKey,0),0),
                   IFERROR(MATCH(LARGE(PriorityKey,G2),PriorityKey,0),0))))
```
أي: في يوم Normal رقم *n* يختار الموضوع صاحب الأولوية رقم *n* (`LARGE(PriorityKey, n)`)؛ ويوم Family يختار أعلى `FamilyKey` (مواضيع غير Tier 1، خفيفة).
- **الدقائق المقترحة** (`N`):
```
=IF(D2="Rest",0, IF(E2<=0,0,
  IF(D2="Low Energy", MIN(20,MAX(10,E2)),
   IF(D2="Family",   MIN(45,MAX(20,E2)),
                     MIN(45,MAX(25,E2))))))
```
تُقصّ ضمن حدود كل نمط: Normal [25–45]، Low Energy [10–20]، Family [20–45].
- **نصّ المهمة** (`O`): يبني الجملة من قوالب `NormalTaskTemplates`/`LowEnergyTasks` + اسم الموضوع، أو "Rest..."، أو "No included topics. Update Topic Planner." عند غياب المواضيع.
- **أعلام** (`P` TooMuch = N>E، `Q` TooLittle = يوم Normal وE<25).

### 5.6 ورقة `_Calc` (تجميعات ومصادر الرسوم)
أمثلة فعلية:
| الخلية | الصيغة | الوظيفة |
|---|---|---|
| `B24` `PlannedHrs` | `=SUMIFS(TopicHours,TopicInclude,"Yes")` | إجمالي الساعات المخطّطة (=150.5) |
| `B25` `CompletedHrs` | `=SUMIFS(TopicCompleted,TopicInclude,"Yes")` | الساعات المنجزة |
| `B27` `ProgressPct` | `=IFERROR(B25/B24,0)` | **نسبة التقدّم (سليمة وخطّية)** |
| `B28` `ReadinessPct` | `=IFERROR(SUMPRODUCT(TopicPriority,TopicCompleted)/SUMPRODUCT(TopicPriority,TopicHours),0)` | **درجة الجاهزية (معيبة — انظر 5.7)** |
| `B23` `HighPriRem` | `=SUMPRODUCT((TopicPriority>=5)*(TopicInclude="Yes")*(TopicCompleted<TopicHours)*(TopicStatus<>"Exam Ready"))` | عدد المواضيع عالية الأولوية غير المكتملة |
| `B15:D19` | `=INDEX(TopicName,MATCH(LARGE(PriorityKey,1),PriorityKey,0))` ... | **Top 5** مواضيع (اسم/درجة/قسم) |

### 5.7 خلل مُثبَت رقميًا: درجة الجاهزية `ReadinessPct` غير رتيبة (non-monotonic)
بما أن أولوية الموضوع `K` **تنهار إلى 10%** عند اكتماله، فإن مساهمته في بسط ومقام `ReadinessPct` تنكمش، ما يجعل المؤشّر **يُقلّل تقدير الإنجاز بشدّة بل وقد ينخفض عند إنهاء موضوع**. محاكاة على بيانات الملف الفعلية (85 موضوعًا، 150.5 ساعة):

| المواضيع المكتملة | % الساعات المنجزة | درجة الجاهزية المعروضة |
|:-:|:-:|:-:|
| 0 | 0% | 0.00% |
| 30 | 45.5% | **11.23%** |
| 42 | 60.8% | 19.32% |
| 60 | 81.1% | 40.79% |
| 80 | 96.7% | 83.33% |
| 85 | 100% | 100% |

وأوضح دليل: إنهاء الموضوع الأول (من 99%→100% منفردًا) يغيّر الجاهزية **من 1.84% إلى 0.19%** أي **−1.65 نقطة** (تنخفض عند الإنجاز!). بينما `ProgressPct` خطّية وسليمة. (تفصيل في تقرير 05.)

### 5.8 العدّاد الزمني في `Dashboard`
```
A5 = =C21                         (Exam Date)
D5 = =C21-TODAY()                 (Days Remaining = 74 وقت الحفظ)
G5 = =ROUND((C21-TODAY())/7,1)    (Weeks Remaining = 10.6)
```
**حافة (edge case):** بعد مرور تاريخ الامتحان تصبح `Days Remaining` **سالبة** دون أي حماية.

### 5.9 ملخّص المخاطر في الصيغ
- **نطاقات صلبة (hardcoded ranges):** كل الـ Named Ranges مثبّتة حتى الصف 86 (المواضيع) و8 (المحرّك) و12 (الأسبوع). إضافة موضوع في الصف 87 **لن يُحتسب**.
- **`TODAY()` متطايرة:** إعادة حساب عند كل تغيير/فتح (مقبول هنا، 7 مواضع فقط).
- **لا أخطاء حالية:** 0 خلية `#REF!`/`#VALUE!`/`#DIV/0!`/`#N/A` بفضل تغليف `IFERROR` المنهجي.
- **حافة:** لو كانت المواضيع المُضمَّنة أقل من عدد أيام Normal، فإن `LARGE(PriorityKey, n)` لرتبة كبيرة قد يلتقط مواضيع مستبعَدة (درجتها ≈ 0).

---

## 6. التحقّق من المدخلات (Data Validation) وضوابط المستخدم

8 نطاقات تحقّق، **كلها من نوع `list` بقوائم مكتوبة مباشرة (inline)** وليست مرتبطة بـ Named Ranges:

| الورقة | النطاق | القائمة | ملاحظة |
|---|---|---|---|
| Dashboard | `C23` | Flexible, Daily, Non-Daily | (Study Style — غير مستخدم في أي صيغة) |
| Dashboard | `H20:H26` | 1,2,3,4,5 | Energy |
| Dashboard | `I20:I26` | Normal, Low Energy, Family, Rest | Mode |
| Topic Planner | `A2:A86` | Yes, No, Later | Include? |
| Topic Planner | `G2:J86` | 1,2,3,4,5 | يغطّي Confidence + **Difficulty + Boredom + Quick Win** |
| Topic Planner | `L2:L86` | Deep/Standard/Fast Review/Light Review/Skip Unless Time | Recommended Depth |
| Topic Planner | `P2:P86` | Not Started ... Exam Ready, Skipped | Status |
| Weekly Plan | `H6:H12` | Yes, No, Skipped | Done? |

**نقاط ضعف مؤكَّدة في التحقّق:**
1. **`showErrorMessage = False` في كل القواعد الثماني**: أي أن Excel **لا يرفض** القيمة الخاطئة عند الكتابة/اللصق؛ القائمة المنسدلة موجودة للراحة فقط، لكن لا يوجد **منع فعلي** للإدخال غير الصحيح، ولا رسائل إدخال (input prompts) ولا رسائل خطأ (error alerts).
2. **لا تحقّق إطلاقًا على `Daily Minutes` (`G20:G26`)**: يمكن إدخال أي رقم أو حتى نص.
3. **لا تحقّق على التواريخ** `Exam Date C21` / `Start Date C22` (قد تُدخَل تواريخ غير منطقية أو في الماضي).
4. **لا تحقّق على** `Completed Hrs (N)`، `Suggested Hrs (M)`، `Avg Wt (E)`، `Tier (F)` — رغم حساسيتها (قد تُكتب قيمة سالبة أو Tier=9).
5. القائمة المنسدلة على `Difficulty/Quick Win` (ضمن `G:J`) قد **توحي بأنها مدخلات** بينما الدليل يصنّفها كثوابت يحدّدها المؤلّف.

---

## 7. التنسيق الشرطي (Conditional Formatting) والتصميم البصري

34 قاعدة. لوحة ألوان متّسقة: أحمر/سلموني `F8CBAD`، أصفر `FFE699`، أخضر `C6E0B4`، رمادي `D9D9D9`، مع Color Scales ثلاثية اللون.

**Dashboard (16 قاعدة):**
- `D5:F5` (Days Remaining): <14 أحمر، <30 أصفر، ≥30 أخضر.
- `J5:L5` (Progress): <0.3 أحمر، <0.6 أصفر. `M5:O5` (Readiness) مثلها.
- `M8:O8` (High-Priority Remaining): >10 أحمر، >5 أصفر، ≤5 أخضر.
- `H20:H26` (Energy): Color Scale. `I20:I26` (Mode): Rest رمادي، Family وردي، Low Energy كريمي.
- `R20:R26` (Done preview): Yes أخضر، Skipped رمادي.

**Topic Planner (10 قواعد):**
- `K` (Priority)، `G` (Confidence)، `O` (Progress): Color Scales.
- `P` (Status): Exam Ready/Strong أخضر، Improving أزرق، Practicing أزرق فاتح، Skipped رمادي.
- صفّ كامل `A2:R86` رمادي عند `Include=No`.
- **تمييز ذكي:** `AND($K2>=5,$G2<=2,$A2="Yes")` ⇒ برتقالي = "أولوية عالية مع ثقة منخفضة = مكسب كبير".

**Weekly Plan (8 قواعد):** `H` (Done) أخضر/رمادي، `C` (Mode) تلوين، `G17` (Capacity) Under أصفر / Over أحمر / Balanced أخضر.

**ملاحظات:**
- لا توجد قاعدة لون لحالتَي `Not Started` و`Learning` في عمود الحالة (تمييز ناقص بسيط).
- لا قواعد متعارضة أو مكرّرة ضارّة؛ الأولويات (priorities) مرتّبة منطقيًا.
- النظام البصري **واضح وسهل لغير التقني** عمومًا.

---

## 8. الجداول والنطاقات المُسمّاة والمراجع

- **Excel Tables (ListObjects): لا يوجد.** يعتمد المخطّط على **58 Named Range + AutoFilter** بدلًا من الجداول الديناميكية. هذا أضعف من ناحية التوسّع: الجدول كان سيتمدّد تلقائيًا مع الصفوف الجديدة، أما النطاقات المثبّتة فلا.
- **Named Ranges:** 58 معرّفًا. **32 مستخدَمًا فعليًا بالاسم، و26 غير مستخدَم** (مُعرَّف لكنه لا يُشار إليه باسمه في أي صيغة) — منها كل نطاقات `Plan*` (لأن `Weekly Plan` يشير إلى خلايا `_PlanEngine` مباشرة)، و`TiredKey`، `DeferKey`، `StatusList`، `FamilyTaskTemplates`، `OverallDone/Rem`، `TotalIncluded`... إلخ. (هي ليست "معطوبة" لكنها **حشو يصعّب الصيانة**.)
- **مراجع عبر الأوراق (cross-sheet):** `Weekly Plan` → `_PlanEngine`؛ `Dashboard` → `_Calc` و Named Ranges؛ الرسوم → `_Calc`. التدفّق أحادي الاتجاه ونظيف، **لا مراجع دائرية (circular)**.
- **روابط خارجية (external links): لا يوجد.** **مراجع معطوبة (#REF!): لا يوجد.**
- **قابلية التوسّع:** محدودة بسقف 85 موضوعًا (حتى الصف 86) وأفق 7 أيام ثابت.

### تدفّق التبعية (Dependency Flow) المختصر
```
مدخلات المستخدم (Topic Planner: A,G,H,I,J,N,P  +  Dashboard: G20:I26, C21)
        │
        ▼
Topic Planner!K (Priority)  →  S/V (PriorityKey/FamilyKey)
        │                               │
        ▼                               ▼
   _Calc (تجميعات/Top5)         _PlanEngine (خطة 7 أيام)
        │                               │
        ▼                               ▼
   Dashboard (بطاقات + 4 رسوم)     Weekly Plan (الجدول) → Dashboard (Preview + "اليوم")
```

---

## 9. منطق المخطّط الدراسي (Study Planner Logic)

| السؤال | الإجابة المستخلصة من الصيغ |
|---|---|
| كيف تُحسب أيام المذاكرة؟ | أسبوع واحد متجدّد (7 صفوف)، يبدأ الأحد عبر `TODAY()-WEEKDAY(TODAY(),1)+1`. **لا يُبنى جدول كامل حتى الامتحان.** |
| كيف يُحسب الوقت المتاح؟ | من `Daily Minutes` لكل يوم؛ المجموع/60 = `WeeklyAvail`. |
| كيف تُوزَّع المواضيع؟ | يوم Normal رقم *n* ← الموضوع صاحب الأولوية رقم *n* (مواضيع مميّزة لا تتكرّر بين أيام Normal في الأسبوع). |
| أيام المراجعة؟ | Family = مراجعة خفيفة لموضوع غير Tier 1؛ Low Energy = مهمة عامة دوّارة (بدون موضوع محدّد). |
| أثر تاريخ الامتحان/المواعيد؟ | **عرضي فقط** (عدّاد Days/Weeks Remaining). **لا يؤثّر في توليد الخطة ولا في الوتيرة.** |
| عطلات/أيام راحة/أيام محظورة؟ | نمط `Rest` = 0 دقيقة "Rest. No study required." (يُضبط يدويًا لكل يوم). لا تقويم عطلات رسمي. |
| هل تتكيّف الخطة مع التقدّم؟ | نعم جزئيًا: عند رفع `Completed`/تغيير `Status` تنخفض الأولوية (×0.1 عند الاكتمال) فيتغيّر ترتيب المواضيع. لكن التحديث **يدوي**. |
| الأيام الفائتة/إعادة الجدولة؟ | **لا يوجد** أي ترحيل لليوم الفائت؛ ولا سجلّ تاريخي. |
| ثابتة أم شبه آلية أم آلية؟ | **شبه آلية**: التوليد آلي بالكامل لأسبوع واحد، لكن المتابعة والتقدّم وضبط التوافر **يدوية**. |

---

## 10. الملحق التقني (Technical Appendix) — مقتطفات

### 10.1 قائمة الأوراق
`Dashboard` (visible) · `Topic Planner` (visible) · `Weekly Plan` (visible) · `_Lists` (hidden) · `_Calc` (hidden) · `_PlanEngine` (hidden).

### 10.2 النطاقات المُسمّاة غير المستخدمة (26)
`DeferKey, FamilyTaskTemplates, OverallDone, OverallRem, PlanAutoTask, PlanAvailMins, PlanDate, PlanDay, PlanEnergy, PlanMode, PlanSuggestMins, PlanTopicIdx, PlanTopicName, PlanTopicSection, PlanTopicTier, PlannedHrs, StatusList, TiredKey, TopicAction, TopicBoredom, TopicDepth, TopicDiff, TopicProgress, TotalIncluded, WeeklyPlanActual, WeeklyPlanDate`.

### 10.3 الرسوم البيانية (4، في Dashboard)
| الرسم | النوع | المصدر |
|---|---|---|
| Overall Progress | Doughnut | `_Calc!B2:B3` (منجز/متبقٍّ) |
| Top 5 by Priority | Bar | `_Calc!C15:C19` |
| Topic Status | Bar | `_Calc!B6:B12` |
| Weekly Hours | Bar | `_Calc!B38:B39` (متاح/مخطّط) |

### 10.4 ملخّص الحماية
لا حماية مصنّف، لا حماية أوراق، لا كلمات مرور، `DocSecurity=0`.

### 10.5 ملخّص الروابط الخارجية
لا يوجد (`LinksUpToDate=false`، ولا أجزاء `externalLinks`).

### 10.6 القوائم في `_Lists`
- `LowEnergyTasks` (B2:B7): 6 مهام خفيفة (FE Handbook formula lookup، Review solved example، Mistake review، Flashcard review، Light Ethics review، Engineering Economics drill).
- `NormalTaskTemplates` (C2:C4) و`FamilyTaskTemplates` (D2:D4): قوالب جُمل (الأخيرة غير مستخدمة).
- `DayNames` (G2:G8): Sunday→Saturday. `StatusList` (I2:I8): قائمة الحالات (غير مستخدمة كـ Named Range).

### 10.7 توزيع الـ Tiers (مستخلص من البيانات)
- **Tier 1 (7 أقسام):** Mathematics, Ethics & Professional Practice, Engineering Economics, Circuit Analysis, Electronics, Power Systems, Digital Systems.
- **Tier 2:** Probability & Statistics, Linear Systems, Signal Processing, Control Systems, Communications, Computer Systems, Software Engineering.
- **Tier 3:** Properties of Electrical Materials, Electromagnetics, Computer Networks.
- أصعب موضوع: `11.3 Electrodynamics & Maxwell's Equations` (Confidence=1، Difficulty=5، Boredom=5، QuickWin=1).


