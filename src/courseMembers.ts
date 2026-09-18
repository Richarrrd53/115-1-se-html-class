export interface CourseMember {
  studentId: string
  name: string
  email?: string
  group?: string
}

export function normalizeName(name: string): string {
  return name.replace(/\s+/g, '').trim()
}

export function normalizeStudentId(studentId: string): string {
  return studentId.trim().toLowerCase()
}

export const COURSE_MEMBERS: CourseMember[] = [
  {
    "studentId": "113213081",
    "name": "何彥緻",
    "email": "s113213081@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213047",
    "name": "余秉軒",
    "email": "s113213047@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213018",
    "name": "余采霏",
    "email": "s113213018@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213056",
    "name": "傅宇呈",
    "email": "s113213056@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "112321081",
    "name": "傅詰閔",
    "email": "s112321081@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213067",
    "name": "劉宜欣",
    "email": "s113213067@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213006",
    "name": "劉采蓁",
    "email": "s113213006@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "112213077",
    "name": "卓柏睿",
    "email": "s112213077@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213054",
    "name": "卓進幸",
    "email": "s113213054@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113251027",
    "name": "吳凱祐",
    "email": "s113251027@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213070",
    "name": "吳芳慈",
    "email": "s113213070@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213024",
    "name": "宋政賢",
    "email": "s113213024@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213053",
    "name": "張婷婷",
    "email": "s113213053@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213057",
    "name": "張媛淇",
    "email": "s113213057@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213061",
    "name": "張庭綸",
    "email": "s113213061@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113251007",
    "name": "張慶宇",
    "email": "s113251007@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213029",
    "name": "張靖程",
    "email": "s113213029@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213002",
    "name": "文鈺棼",
    "email": "s113213002@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213040",
    "name": "李嘉鋒",
    "email": "s113213040@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213036",
    "name": "李關關",
    "email": "s113213036@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "111213077",
    "name": "林冠伶",
    "email": "s111213077@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "114213526",
    "name": "林柏成",
    "email": "s114213526@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213023",
    "name": "林毓琦",
    "email": "s113213023@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113251036",
    "name": "林泓諭",
    "email": "s113251036@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213075",
    "name": "柯宥澤",
    "email": "s113213075@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213017",
    "name": "江科甫",
    "email": "s113213017@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213071",
    "name": "沈睿恆",
    "email": "s113213071@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213077",
    "name": "温佳哲",
    "email": "s113213077@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213015",
    "name": "王世儀",
    "email": "s113213015@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213032",
    "name": "王奕惟",
    "email": "s113213032@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "112213022",
    "name": "王子豪",
    "email": "s112213022@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213001",
    "name": "王心妍",
    "email": "s113213001@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213076",
    "name": "王志騰",
    "email": "s113213076@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113251038",
    "name": "王敬浩",
    "email": "s113251038@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213033",
    "name": "王齡玉",
    "email": "s113213033@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "112251004",
    "name": "畢維展",
    "email": "s112251004@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213064",
    "name": "盧德展",
    "email": "s113213064@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213026",
    "name": "石鑫",
    "email": "s113213026@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "112213068",
    "name": "莊佩諺",
    "email": "s112213068@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213005",
    "name": "莫舒安",
    "email": "s113213005@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "112321022",
    "name": "蔡尚恩",
    "email": "s112321022@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213013",
    "name": "蔡承軒",
    "email": "s113213013@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213041",
    "name": "蔡褍潔",
    "email": "s113213041@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "114213519",
    "name": "蕭晴澭",
    "email": "s114213519@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213078",
    "name": "薛正裕",
    "email": "s113213078@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213069",
    "name": "蘇資晉",
    "email": "s113213069@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213028",
    "name": "許耘芯",
    "email": "s113213028@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213073",
    "name": "謝宇臻",
    "email": "s113213073@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213065",
    "name": "謝承道",
    "email": "s113213065@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213055",
    "name": "賴承妍",
    "email": "s113213055@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "112213057",
    "name": "趙麗珊",
    "email": "s112213057@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213014",
    "name": "邱郁傑",
    "email": "s113213014@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213004",
    "name": "郭佳瑜",
    "email": "s113213004@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213045",
    "name": "鄧俞明",
    "email": "s113213045@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213062",
    "name": "鄭丞鈞",
    "email": "s113213062@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213022",
    "name": "鄭禹岑",
    "email": "s113213022@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213016",
    "name": "鍾頌恩",
    "email": "s113213016@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113251001",
    "name": "陳荃",
    "email": "s113251001@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213038",
    "name": "陳傳盛",
    "email": "s113213038@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "112213058",
    "name": "陳圓",
    "email": "s112213058@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213035",
    "name": "陳奕凱",
    "email": "s113213035@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213020",
    "name": "陳孝齊",
    "email": "s113213020@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213025",
    "name": "陳宥孝",
    "email": "s113213025@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213083",
    "name": "陳宥蓉",
    "email": "s113213083@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "11408",
    "name": "陳建宏",
    "email": "jhchen@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213021",
    "name": "陳昱維",
    "email": "s113213021@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213030",
    "name": "陳瑋廷",
    "email": "s113213030@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213011",
    "name": "陳芃叡",
    "email": "s113213011@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213037",
    "name": "陳芝妮",
    "email": "s113213037@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213074",
    "name": "陳龍華",
    "email": "s113213074@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "114213517",
    "name": "韓育欣",
    "email": "s114213517@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213010",
    "name": "馮懷立",
    "email": "s113213010@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213060",
    "name": "黃映璇",
    "email": "s113213060@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "112213013",
    "name": "黃晟銘",
    "email": "s112213013@ncnu.edu.tw",
    "group": ""
  },
  {
    "studentId": "113213031",
    "name": "黃科竤",
    "email": "s113213031@ncnu.edu.tw",
    "group": ""
  }
]

export function findLocalMember(studentId: string, name: string): CourseMember | undefined {
  const normId = normalizeStudentId(studentId)
  const normName = normalizeName(name)
  return COURSE_MEMBERS.find(
    (m) => normalizeStudentId(m.studentId) === normId && normalizeName(m.name) === normName,
  )
}
