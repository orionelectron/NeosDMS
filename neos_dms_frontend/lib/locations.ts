export interface Province {
  name: string;
  code: string;
  districts: string[];
}

export const NEPAL_PROVINCES: Province[] = [
  {
    name: "Koshi",
    code: "P1",
    districts: [
      "Bhojpur",
      "Dhankuta",
      "Ilam",
      "Jhapa",
      "Khotang",
      "Morang",
      "Okhaldhunga",
      "Panchthar",
      "Sankhuwasabha",
      "Solukhumbu",
      "Sunsari",
      "Taplejung",
      "Terhathum",
      "Udayapur",
    ],
  },
  {
    name: "Madhesh",
    code: "P2",
    districts: [
      "Bara",
      "Dhanusha",
      "Mahottari",
      "Parsa",
      "Rautahat",
      "Saptari",
      "Sarlahi",
      "Siraha",
    ],
  },
  {
    name: "Bagmati",
    code: "P3",
    districts: [
      "Bhaktapur",
      "Chitwan",
      "Dhading",
      "Dolakha",
      "Kathmandu",
      "Kavrepalanchok",
      "Lalitpur",
      "Makwanpur",
      "Nuwakot",
      "Ramechhap",
      "Rasuwa",
      "Sindhuli",
      "Sindhupalchok",
    ],
  },
  {
    name: "Gandaki",
    code: "P4",
    districts: [
      "Baglung",
      "Gorkha",
      "Kaski",
      "Lamjung",
      "Manang",
      "Mustang",
      "Myagdi",
      "Nawalpur",
      "Parbat",
      "Syangja",
      "Tanahun",
    ],
  },
  {
    name: "Lumbini",
    code: "P5",
    districts: [
      "Arghakhanchi",
      "Banke",
      "Bardiya",
      "Dang",
      "Eastern Rukum",
      "Gulmi",
      "Kapilvastu",
      "Nawalparasi East",
      "Palpa",
      "Pyuthan",
      "Rolpa",
      "Rupandehi",
    ],
  },
  {
    name: "Karnali",
    code: "P6",
    districts: [
      "Dolpa",
      "Humla",
      "Jajarkot",
      "Jumla",
      "Kalikot",
      "Mugu",
      "Salyan",
      "Surkhet",
      "Western Rukum",
    ],
  },
  {
    name: "Sudurpashchim",
    code: "P7",
    districts: [
      "Achham",
      "Baitadi",
      "Bajhang",
      "Bajura",
      "Dadeldhura",
      "Darchula",
      "Doti",
      "Kailali",
      "Kanchanpur",
    ],
  },
];

/** Flat, sorted list of every Nepal district name. */
export const NEPAL_DISTRICTS: string[] = [
  ...new Set(NEPAL_PROVINCES.flatMap((province) => province.districts)),
].sort((a, b) => a.localeCompare(b));

/** All province names, in the standard order. */
export const NEPAL_PROVINCE_NAMES: string[] = NEPAL_PROVINCES.map(
  (province) => province.name,
);

/** Districts that belong to a given province name (case-insensitive). */
export function districtsOfProvince(province: string): string[] {
  const match = NEPAL_PROVINCES.find(
    (candidate) => candidate.name.toLowerCase() === province.toLowerCase(),
  );
  return match ? match.districts : [];
}
