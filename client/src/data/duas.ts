export type DuaCategory = "همّ" | "مغفرة" | "والدين" | "علم";

export type Dua = {
  id: string;
  text: string;
  category: DuaCategory;
  reference: string;
  sourceUrl: string;
};

export const DUA_SOURCE_URL = "https://www.al-adkar.com/adkar/adiya-quraniya";

export const duaCategories: ReadonlyArray<{
  id: "all" | DuaCategory;
  label: string;
}> = [
  { id: "all", label: "الكل" },
  { id: "همّ", label: "الهمّ" },
  { id: "مغفرة", label: "المغفرة" },
  { id: "والدين", label: "الوالدين" },
  { id: "علم", label: "العلم" },
];

/**
 * نصوص أدعية قرآنية، نُقلت كاملة مع السورة ورقم الآية.
 * التصنيف وسيلة لتصفية الواجهة، ولا يغيّر وصف النص أو دلالته.
 */
export const quranicDuas: readonly Dua[] = [
  {
    id: "al-baqarah-201",
    text: "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ.",
    category: "همّ",
    reference: "سورة البقرة · الآية 201",
    sourceUrl: DUA_SOURCE_URL,
  },
  {
    id: "al-baqarah-250",
    text: "رَبَّنَا أَفْرِغْ عَلَيْنَا صَبْرًا وَثَبِّتْ أَقْدَامَنَا وَانْصُرْنَا عَلَى الْقَوْمِ الْكَافِرِينَ.",
    category: "همّ",
    reference: "سورة البقرة · الآية 250",
    sourceUrl: DUA_SOURCE_URL,
  },
  {
    id: "aal-imran-8",
    text: "رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِنْ لَدُنْكَ رَحْمَةً إِنَّكَ أَنْتَ الْوَهَّابُ.",
    category: "همّ",
    reference: "سورة آل عمران · الآية 8",
    sourceUrl: DUA_SOURCE_URL,
  },
  {
    id: "aal-imran-38",
    text: "رَبِّ هَبْ لِي مِنْ لَدُنْكَ ذُرِّيَّةً طَيِّبَةً إِنَّكَ سَمِيعُ الدُّعَاءِ.",
    category: "همّ",
    reference: "سورة آل عمران · الآية 38",
    sourceUrl: DUA_SOURCE_URL,
  },
  {
    id: "al-araf-23",
    text: "رَبَّنَا ظَلَمْنَا أَنْفُسَنَا وَإِنْ لَمْ تَغْفِرْ لَنَا وَتَرْحَمْنَا لَنَكُونَنَّ مِنَ الْخَاسِرِينَ.",
    category: "مغفرة",
    reference: "سورة الأعراف · الآية 23",
    sourceUrl: DUA_SOURCE_URL,
  },
  {
    id: "ibrahim-40",
    text: "رَبِّ اجْعَلْنِي مُقِيمَ الصَّلَاةِ وَمِنْ ذُرِّيَّتِي رَبَّنَا وَتَقَبَّلْ دُعَاءِ.",
    category: "همّ",
    reference: "سورة إبراهيم · الآية 40",
    sourceUrl: DUA_SOURCE_URL,
  },
  {
    id: "ibrahim-41",
    text: "رَبَّنَا اغْفِرْ لِي وَلِوَالِدَيَّ وَلِلْمُؤْمِنِينَ يَوْمَ يَقُومُ الْحِسَابُ.",
    category: "والدين",
    reference: "سورة إبراهيم · الآية 41",
    sourceUrl: DUA_SOURCE_URL,
  },
  {
    id: "al-kahf-10",
    text: "رَبَّنَا آتِنَا مِنْ لَدُنْكَ رَحْمَةً وَهَيِّئْ لَنَا مِنْ أَمْرِنَا رَشَدًا.",
    category: "همّ",
    reference: "سورة الكهف · الآية 10",
    sourceUrl: DUA_SOURCE_URL,
  },
  {
    id: "taha-25-28",
    text: "رَبِّ اشْرَحْ لِي صَدْرِي وَيَسِّرْ لِي أَمْرِي وَاحْلُلْ عُقْدَةً مِنْ لِسَانِي يَفْقَهُوا قَوْلِي.",
    category: "علم",
    reference: "سورة طه · الآيات 25–28",
    sourceUrl: DUA_SOURCE_URL,
  },
  {
    id: "taha-114",
    text: "رَبِّ زِدْنِي عِلْمًا.",
    category: "علم",
    reference: "سورة طه · الآية 114",
    sourceUrl: DUA_SOURCE_URL,
  },
  {
    id: "al-anbiya-87",
    text: "لَا إِلَهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ.",
    category: "مغفرة",
    reference: "سورة الأنبياء · الآية 87",
    sourceUrl: DUA_SOURCE_URL,
  },
  {
    id: "al-muminun-118",
    text: "رَبِّ اغْفِرْ وَارْحَمْ وَأَنْتَ خَيْرُ الرَّاحِمِينَ.",
    category: "مغفرة",
    reference: "سورة المؤمنون · الآية 118",
    sourceUrl: DUA_SOURCE_URL,
  },
];
