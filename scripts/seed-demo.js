import { ObjectId } from "mongodb";
import { clientUrl } from "../src/config.js";
import { closeDB, collections, connectDB } from "../src/db.js";

const apiUrl = (process.env.SEED_API_URL || `http://localhost:${process.env.PORT || 8000}`).replace(/\/$/, "");
const password = process.env.SEED_VENDOR_PASSWORD;
const imgbbKey = process.env.IMGBB_API_KEY;

const photos = {
  confettiKiss: "1583939003579-730e3918a45a",
  veilHug: "1546032996-6dfacbacbf3f",
  ringHands: "1465495976277-4387d4b0b4c6",
  lakeCouple: "1591604466107-ec97de577aff",
  bouquetCouple: "1519741497674-611481863552",
  beachCouple: "1537633552985-df8429e8048b",
  holdingHands: "1520854221256-17451cc331bf",
  buffet: "1555244162-803834f70033",
  platedDinner: "1414235077428-338989a2e8c0",
  banquetHall: "1464366400600-7168b8af9bc3",
  flowerArch: "1529636798458-92182e662485",
  gardenAisle: "1469371670807-013ccf25f16a",
  mrMrsSign: "1507504031003-b417219a0fde",
  roseBouquet: "1525258946800-98cfd641d0de",
  tableFlowers: "1519225421980-715cb0215aed",
  lakeChairs: "1522673607200-164d1b6ce486",
  resortPool: "1600011689032-8b628b8a8747",
  bridalMakeup: "1487412947147-5cebf100ffc2",
  salon: "1560066984-138dadb4c035",
  redGown: "1595777457583-95e059d581b8",
  flowingDress: "1478146896981-b80fe463b330",
  colourfulFabric: "1617331721458-bd3bd3f9c7f8",
};

const vendors = [
  {
    name: "Rafiq Hasan",
    email: "goldenframe.studio@example.com",
    businessName: "Golden Frame Studio",
    services: [
      {
        serviceName: "Full Day Wedding Photography",
        category: "Photography & Videography",
        location: "Dhaka",
        price: 45000,
        photos: ["confettiKiss", "veilHug", "ringHands"],
        approve: true,
        description:
          "Two photographers cover your wedding from getting ready to the last dance. You get 500 or more edited photos in an online gallery within three weeks, plus a printed album of 40 pages.",
      },
      {
        serviceName: "Cinematic Wedding Film",
        category: "Photography & Videography",
        location: "Dhaka",
        price: 65000,
        photos: ["lakeCouple", "bouquetCouple"],
        approve: true,
        description:
          "A 5 to 8 minute cinematic highlight film and a full ceremony video, shot in 4K with drone coverage where the venue allows it. Music is licensed, and the films are delivered in four weeks.",
      },
      {
        serviceName: "Royal Banquet Catering",
        category: "Catering Services",
        location: "Dhaka",
        price: 180000,
        photos: ["buffet", "platedDinner", "banquetHall"],
        approve: true,
        description:
          "Kacchi biryani, roast chicken, beef rezala, salads, borhani and firni for 300 guests. The price includes serving staff, chafing dishes and clean-up at your venue anywhere in Dhaka.",
      },
    ],
  },
  {
    name: "Tahmina Akter",
    email: "shapla.decor@example.com",
    businessName: "Shapla Decor and Florals",
    services: [
      {
        serviceName: "Garden Stage and Gate Decoration",
        category: "Decoration & Florist",
        location: "Sylhet",
        price: 85000,
        photos: ["flowerArch", "gardenAisle", "mrMrsSign"],
        approve: true,
        description:
          "A full stage with a fresh flower backdrop, an entrance gate, aisle flowers and warm fairy lights. We set up the day before and take everything down after the event.",
      },
      {
        serviceName: "Fresh Flower Bridal Bouquets",
        category: "Decoration & Florist",
        location: "Sylhet",
        price: 6500,
        photos: ["roseBouquet", "tableFlowers"],
        approve: false,
        description:
          "Hand-tied bridal bouquet with roses and seasonal flowers, plus two small bouquets for bridesmaids. Colours are matched to your outfit, and delivery in Sylhet city is free.",
      },
      {
        serviceName: "Tea Garden Lakeside Venue",
        category: "Wedding Venues",
        location: "Sylhet",
        price: 150000,
        photos: ["lakeChairs", "gardenAisle"],
        approve: true,
        description:
          "An open lawn by the lake, surrounded by tea gardens, with seating for up to 250 guests. Includes a covered dining area, generator backup, parking and a changing room for the bride.",
      },
    ],
  },
  {
    name: "Imran Chowdhury",
    email: "bayview.events@example.com",
    businessName: "Bay View Events",
    services: [
      {
        serviceName: "Beachfront Wedding Venue",
        category: "Wedding Venues",
        location: "Cox's Bazar",
        price: 280000,
        photos: ["resortPool", "beachCouple"],
        approve: true,
        description:
          "A resort lawn and pool deck facing the sea, for up to 300 guests. Includes sunset ceremony setup, lighting, sound system and two nights in a sea view room for the couple.",
      },
      {
        serviceName: "Seaside Wedding Photography",
        category: "Photography & Videography",
        location: "Cox's Bazar",
        price: 38000,
        photos: ["beachCouple", "holdingHands"],
        approve: true,
        description:
          "A relaxed couple shoot on the beach at golden hour plus full coverage of your wedding day. You get 300 or more edited photos and a short highlight reel for social media.",
      },
      {
        serviceName: "Seafood Feast Catering",
        category: "Catering Services",
        location: "Cox's Bazar",
        price: 120000,
        photos: ["platedDinner", "buffet"],
        approve: true,
        description:
          "Grilled fish, prawn malai curry, chicken roast, polao, salads and desserts for 200 guests. Cooked fresh on site with a live grill station that guests love.",
      },
    ],
  },
  {
    name: "Nupur Das",
    email: "nupur.bridal@example.com",
    businessName: "Nupur Bridal Studio",
    services: [
      {
        serviceName: "Bridal Makeup and Hair",
        category: "Makeup & Styling",
        location: "Chattogram",
        price: 22000,
        photos: ["bridalMakeup", "salon"],
        approve: true,
        description:
          "HD bridal makeup, hair styling, saree or lehenga draping and jewellery setting. A trial session is included, and we can come to your home or venue in Chattogram.",
      },
      {
        serviceName: "Party Makeup for Family",
        category: "Makeup & Styling",
        location: "Chattogram",
        price: 4500,
        photos: ["salon", "bridalMakeup"],
        approve: false,
        description:
          "Party makeup and simple hair styling for mothers, sisters and friends of the bride. Book for three or more people and we send a second artist at no extra cost.",
      },
      {
        serviceName: "Designer Bridal Gown Rental",
        category: "Wedding Fashion",
        location: "Chattogram",
        price: 35000,
        photos: ["redGown", "flowingDress", "colourfulFabric"],
        approve: true,
        description:
          "Rent a designer bridal gown or lehenga for your reception, with fitting and small alterations included. Pick up three days before the event and return two days after.",
      },
    ],
  },
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function cookiesFrom(response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

async function authRequest(path, body) {
  const response = await fetch(`${clientUrl}/api/auth${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: clientUrl },
    body: JSON.stringify(body),
  });
  return { response, data: await response.json().catch(() => null) };
}

async function signInOrUp(vendor) {
  const signIn = await authRequest("/sign-in/email", { email: vendor.email, password });

  if (signIn.response.ok) {
    return { cookie: cookiesFrom(signIn.response), created: false };
  }

  const signUp = await authRequest("/sign-up/email", {
    name: vendor.name,
    email: vendor.email,
    password,
    role: "vendor",
    businessName: vendor.businessName,
  });

  if (!signUp.response.ok) {
    throw new Error(`Could not create ${vendor.email}: ${signUp.data?.message ?? signUp.response.status}`);
  }

  return { cookie: cookiesFrom(signUp.response), created: true };
}

async function getToken(cookie) {
  const response = await fetch(`${clientUrl}/api/auth/token`, { headers: { Cookie: cookie } });
  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.token) {
    throw new Error("Could not get an API token");
  }

  return data.token;
}

const uploaded = new Map();

async function uploadPhoto(key) {
  if (uploaded.has(key)) return uploaded.get(key);

  const source = `https://images.unsplash.com/photo-${photos[key]}?w=1600&q=80&fm=jpg`;
  const form = new FormData();
  form.append("image", source);

  const response = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, {
    method: "POST",
    body: form,
  });
  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.data?.url) {
    throw new Error(`ImgBB upload failed for ${key}`);
  }

  uploaded.set(key, data.data.url);
  return data.data.url;
}

async function createService(token, service) {
  const images = [];
  for (const key of service.photos) images.push(await uploadPhoto(key));

  const response = await fetch(`${apiUrl}/api/services`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      serviceName: service.serviceName,
      category: service.category,
      description: service.description,
      price: service.price,
      location: service.location,
      images,
    }),
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`Could not create "${service.serviceName}": ${data?.message ?? response.status}`);
  }

  return data.service._id;
}

if (!password || !imgbbKey) {
  console.error("SEED_VENDOR_PASSWORD and IMGBB_API_KEY must be set in .env");
  process.exit(1);
}

let exitCode = 0;
const summary = { vendorsCreated: 0, vendorsReused: 0, servicesCreated: 0, servicesSkipped: 0, approved: 0, pending: 0 };

try {
  await connectDB();

  for (const [index, vendor] of vendors.entries()) {
    if (index > 0) await wait(4000);

    const { cookie, created } = await signInOrUp(vendor);
    created ? summary.vendorsCreated++ : summary.vendorsReused++;
    const token = await getToken(cookie);
    const user = await collections.users.findOne({ email: vendor.email });
    console.log(`${created ? "Created" : "Signed in as"} ${vendor.businessName} (${vendor.email})`);

    for (const service of vendor.services) {
      const existing = await collections.services.findOne({
        vendorId: user._id,
        serviceName: service.serviceName,
      });

      let serviceId = existing?._id;

      if (existing) {
        summary.servicesSkipped++;
        console.log(`  skipped "${service.serviceName}" (already exists)`);
      } else {
        serviceId = new ObjectId(await createService(token, service));
        summary.servicesCreated++;
        console.log(`  created "${service.serviceName}"`);
      }

      if (service.approve) {
        await collections.services.updateOne(
          { _id: serviceId, status: "pending" },
          { $set: { status: "approved", updatedAt: new Date() } },
        );
        summary.approved++;
      } else {
        summary.pending++;
      }
    }
  }

  console.log("Done:", JSON.stringify(summary));
} catch (error) {
  console.error(`Seeding stopped: ${error.message}`);
  exitCode = 1;
} finally {
  await closeDB();
}

process.exit(exitCode);
