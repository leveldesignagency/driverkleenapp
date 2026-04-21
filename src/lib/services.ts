import { ServiceCategory } from "@/types";

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    id: "exterior",
    name: "Exterior Cleaning",
    icon: "Home",
    description: "Driveways, patios, decking, walls, and fences",
    services: [
      {
        id: "driveway",
        name: "Driveway Cleaning",
        description: "High-pressure wash for driveways and paths",
        basePrice: 80,
        pricePerUnit: 30,
        estimatedMinutes: 120,
        categoryId: "exterior",
        enabled: true,
      },
      {
        id: "patio",
        name: "Patio Cleaning",
        description: "Deep clean for patios and outdoor seating areas",
        basePrice: 60,
        pricePerUnit: 25,
        estimatedMinutes: 90,
        categoryId: "exterior",
        enabled: true,
      },
      {
        id: "decking",
        name: "Decking Cleaning",
        description: "Specialist wood or composite decking treatment",
        basePrice: 70,
        pricePerUnit: 28,
        estimatedMinutes: 100,
        categoryId: "exterior",
        enabled: true,
      },
      {
        id: "wall-fence",
        name: "Wall & Fence Cleaning",
        description: "Exterior wall and fence cleaning and restoration",
        basePrice: 50,
        pricePerUnit: 20,
        estimatedMinutes: 90,
        categoryId: "exterior",
        enabled: true,
      },
    ],
  },
  {
    id: "interior",
    name: "Interior Cleaning",
    icon: "Sparkles",
    description: "Full house, room-by-room, or specific area cleaning",
    services: [
      {
        id: "full-house",
        name: "Full House Clean",
        description: "Comprehensive top-to-bottom house cleaning",
        basePrice: 120,
        pricePerUnit: 40,
        estimatedMinutes: 180,
        categoryId: "interior",
        enabled: true,
      },
      {
        id: "room-clean",
        name: "Room Clean",
        description: "Individual room deep clean",
        basePrice: 35,
        pricePerUnit: 15,
        estimatedMinutes: 45,
        categoryId: "interior",
        enabled: true,
      },
      {
        id: "bathroom",
        name: "Bathroom Clean",
        description: "Specialist bathroom deep clean and sanitisation",
        basePrice: 40,
        pricePerUnit: 18,
        estimatedMinutes: 60,
        categoryId: "interior",
        enabled: true,
      },
    ],
  },
  {
    id: "gutter",
    name: "Gutter & Roofline",
    icon: "CloudRain",
    description: "Gutter clearing, fascia, and soffit cleaning",
    services: [
      {
        id: "gutter-clear",
        name: "Gutter Clearing",
        description: "Remove debris and ensure proper drainage",
        basePrice: 80,
        pricePerUnit: 20,
        estimatedMinutes: 90,
        categoryId: "gutter",
        enabled: true,
      },
      {
        id: "fascia-soffit",
        name: "Fascia & Soffit Clean",
        description: "Restore roofline appearance",
        basePrice: 90,
        pricePerUnit: 25,
        estimatedMinutes: 120,
        categoryId: "gutter",
        enabled: true,
      },
    ],
  },
  {
    id: "kitchen",
    name: "Kitchen",
    icon: "ChefHat",
    description: "Oven, hob, extractor, and full kitchen deep cleans",
    services: [
      {
        id: "oven-clean",
        name: "Oven Clean",
        description: "Professional oven and hob deep clean",
        basePrice: 55,
        pricePerUnit: 20,
        estimatedMinutes: 75,
        categoryId: "kitchen",
        enabled: true,
      },
      {
        id: "kitchen-deep",
        name: "Full Kitchen Deep Clean",
        description: "Complete kitchen including appliances and surfaces",
        basePrice: 90,
        pricePerUnit: 35,
        estimatedMinutes: 120,
        categoryId: "kitchen",
        enabled: true,
      },
    ],
  },
  {
    id: "eot",
    name: "End-of-Tenancy",
    icon: "Key",
    description: "Move-out deep clean to landlord/agency standards",
    services: [
      {
        id: "eot-studio",
        name: "Studio / 1 Bed",
        description: "End-of-tenancy clean for studio or 1-bed property",
        basePrice: 150,
        pricePerUnit: 0,
        estimatedMinutes: 240,
        categoryId: "eot",
        enabled: true,
      },
      {
        id: "eot-2bed",
        name: "2–3 Bed Property",
        description: "End-of-tenancy clean for 2–3 bedroom property",
        basePrice: 220,
        pricePerUnit: 0,
        estimatedMinutes: 360,
        categoryId: "eot",
        enabled: true,
      },
      {
        id: "eot-4bed",
        name: "4+ Bed Property",
        description: "End-of-tenancy clean for larger properties",
        basePrice: 320,
        pricePerUnit: 0,
        estimatedMinutes: 480,
        categoryId: "eot",
        enabled: true,
      },
    ],
  },
  {
    id: "vehicle",
    name: "Vehicle Cleaning",
    icon: "Car",
    description: "Car valeting, interior, and exterior vehicle cleaning",
    services: [
      {
        id: "car-exterior",
        name: "Car Exterior Wash",
        description: "Full exterior hand wash and dry",
        basePrice: 30,
        pricePerUnit: 10,
        estimatedMinutes: 45,
        categoryId: "vehicle",
        enabled: true,
      },
      {
        id: "car-interior",
        name: "Car Interior Valet",
        description: "Full interior vacuum, wipe, and freshen",
        basePrice: 45,
        pricePerUnit: 15,
        estimatedMinutes: 60,
        categoryId: "vehicle",
        enabled: true,
      },
      {
        id: "car-full",
        name: "Full Valet",
        description: "Complete interior and exterior valet service",
        basePrice: 70,
        pricePerUnit: 20,
        estimatedMinutes: 90,
        categoryId: "vehicle",
        enabled: true,
      },
    ],
  },
  {
    id: "garden",
    name: "Garden",
    icon: "TreePine",
    description: "Garden tidying, lawn care, and green waste removal",
    services: [
      {
        id: "garden-tidy",
        name: "Garden Tidy-Up",
        description: "General garden clearance and tidying",
        basePrice: 60,
        pricePerUnit: 20,
        estimatedMinutes: 120,
        categoryId: "garden",
        enabled: true,
      },
      {
        id: "lawn-care",
        name: "Lawn Care",
        description: "Mowing, edging, and lawn treatment",
        basePrice: 40,
        pricePerUnit: 15,
        estimatedMinutes: 60,
        categoryId: "garden",
        enabled: true,
      },
    ],
  },
  {
    id: "commercial",
    name: "Commercial Cleaning",
    icon: "Building2",
    description: "Office, retail, and commercial property cleaning",
    services: [
      {
        id: "office-clean",
        name: "Office Clean",
        description: "Regular or one-off office cleaning",
        basePrice: 100,
        pricePerUnit: 40,
        estimatedMinutes: 120,
        categoryId: "commercial",
        enabled: true,
      },
      {
        id: "retail-clean",
        name: "Retail Premises Clean",
        description: "Shopfront and retail unit cleaning",
        basePrice: 90,
        pricePerUnit: 35,
        estimatedMinutes: 120,
        categoryId: "commercial",
        enabled: true,
      },
      {
        id: "warehouse-clean",
        name: "Warehouse / Industrial",
        description: "Large-scale commercial space cleaning",
        basePrice: 200,
        pricePerUnit: 60,
        estimatedMinutes: 300,
        categoryId: "commercial",
        enabled: true,
      },
    ],
  },
  {
    id: "waste",
    name: "Waste Removal",
    icon: "Trash2",
    description: "Rubbish clearance, recycling, and waste disposal",
    services: [
      {
        id: "general-waste",
        name: "General Waste Removal",
        description: "Collection and disposal of household waste",
        basePrice: 80,
        pricePerUnit: 30,
        estimatedMinutes: 60,
        categoryId: "waste",
        enabled: true,
      },
      {
        id: "garden-waste",
        name: "Garden Waste Removal",
        description: "Green waste collection and disposal",
        basePrice: 60,
        pricePerUnit: 25,
        estimatedMinutes: 45,
        categoryId: "waste",
        enabled: true,
      },
    ],
  },
];

export function getCategory(categoryId: string) {
  return SERVICE_CATEGORIES.find((c) => c.id === categoryId);
}

export function getService(serviceId: string) {
  for (const category of SERVICE_CATEGORIES) {
    const service = category.services.find((s) => s.id === serviceId);
    if (service) return service;
  }
  return undefined;
}

export function getCategoriesForType(type: "domestic" | "commercial") {
  if (type === "commercial") {
    return SERVICE_CATEGORIES.filter((c) =>
      ["commercial", "waste", "exterior"].includes(c.id)
    );
  }
  return SERVICE_CATEGORIES.filter((c) => c.id !== "commercial");
}
