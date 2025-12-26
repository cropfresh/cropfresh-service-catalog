/**
 * Educational Content Seed Data
 * Story 3.11: Educational Content on Quality Best Practices
 * 
 * Seeds the database with initial educational content for testing and demo.
 * Run with: npx ts-node src/seeds/education-seed.ts
 */

import { prisma } from '../lib/prisma';
import { ContentType, ContentCategory, QualityIssue } from '../generated/prisma/client';

interface SeedContent {
    type: ContentType;
    title: string;
    titleRegional?: Record<string, string>;
    description: string;
    thumbnailUrl: string;
    contentUrl: string;
    durationSeconds?: number;
    readTimeMinutes?: number;
    language: string;
    cropTypes: string[];
    categories: ContentCategory[];
    qualityIssues: QualityIssue[];
    isFeatured: boolean;
}

const seedContent: SeedContent[] = [
    // HARVEST category
    {
        type: 'VIDEO',
        title: 'Best Tomato Harvest Techniques',
        titleRegional: { kn: 'ಟೊಮೇಟೊ ಕೊಯ್ಲು ತಂತ್ರಗಳು', hi: 'टमाटर की सबसे अच्छी तुड़ाई तकनीक' },
        description: 'Learn the optimal time and method to harvest tomatoes for maximum freshness and quality grade.',
        thumbnailUrl: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400',
        contentUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        durationSeconds: 180,
        language: 'en',
        cropTypes: ['TOMATO'],
        categories: ['HARVEST'],
        qualityIssues: ['RIPENESS_ISSUES'],
        isFeatured: true,
    },
    {
        type: 'ARTICLE',
        title: 'When to Harvest Onions: A Complete Guide',
        titleRegional: { kn: 'ಈರುಳ್ಳಿ ಕೊಯ್ಲು ಸಮಯ', hi: 'प्याज की कटाई कब करें' },
        description: 'Understanding the signs of onion maturity and proper harvesting techniques.',
        thumbnailUrl: 'https://images.unsplash.com/photo-1518977956812-cd3dbadaaf31?w=400',
        contentUrl: `## When to Harvest Onions

### Signs of Maturity
1. **Tops falling over** - When 50-80% of tops have fallen, onions are ready
2. **Neck softening** - The neck area becomes soft
3. **Bulb size** - Bulbs reach expected size for variety

### Harvesting Steps
1. Stop watering 1-2 weeks before harvest
2. Gently loosen soil around bulbs
3. Pull onions carefully, don't bruise
4. Allow to cure in sun for 2-3 days

### Storage Tips
- Store in cool, dry place
- Good air circulation prevents rot
- Inspect regularly for spoilage`,
        readTimeMinutes: 5,
        language: 'en',
        cropTypes: ['ONION'],
        categories: ['HARVEST'],
        qualityIssues: ['RIPENESS_ISSUES', 'FRESHNESS_CONCERNS'],
        isFeatured: false,
    },

    // HANDLING category
    {
        type: 'VIDEO',
        title: 'Gentle Handling Techniques to Prevent Bruising',
        titleRegional: { kn: 'ಮೃದುವಾಗಿ ನಿರ್ವಹಿಸುವ ತಂತ್ರಗಳು', hi: 'नुकसान से बचाने के लिए सावधानीपूर्वक हैंडलिंग' },
        description: 'Essential techniques to handle produce gently and avoid bruising that affects your quality grade.',
        thumbnailUrl: 'https://images.unsplash.com/photo-1498579397066-22750a3cb424?w=400',
        contentUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        durationSeconds: 240,
        language: 'en',
        cropTypes: ['TOMATO', 'POTATO', 'ONION'],
        categories: ['HANDLING'],
        qualityIssues: ['BRUISING'],
        isFeatured: true,
    },
    {
        type: 'INFOGRAPHIC',
        title: 'Do\'s and Don\'ts of Produce Handling',
        titleRegional: { kn: 'ಉತ್ಪನ್ನ ನಿರ್ವಹಣೆ', hi: 'उत्पाद हैंडलिंग के नियम' },
        description: 'Quick visual guide to proper produce handling.',
        thumbnailUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400',
        contentUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=1200',
        language: 'en',
        cropTypes: ['TOMATO', 'POTATO', 'ONION', 'CARROT'],
        categories: ['HANDLING'],
        qualityIssues: ['BRUISING'],
        isFeatured: false,
    },

    // STORAGE category
    {
        type: 'VIDEO',
        title: 'Cold Storage Best Practices',
        titleRegional: { kn: 'ಶೀತಲ ಸಂಗ್ರಹಣೆ ಅಭ್ಯಾಸಗಳು', hi: 'कोल्ड स्टोरेज की सर्वोत्तम प्रथाएं' },
        description: 'Learn how to properly store vegetables in cold storage to maintain freshness.',
        thumbnailUrl: 'https://images.unsplash.com/photo-1595231712325-9fedecef7575?w=400',
        contentUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        durationSeconds: 300,
        language: 'en',
        cropTypes: ['TOMATO', 'POTATO', 'CARROT'],
        categories: ['STORAGE'],
        qualityIssues: ['FRESHNESS_CONCERNS'],
        isFeatured: true,
    },
    {
        type: 'ARTICLE',
        title: 'Pre-Delivery Storage Tips',
        titleRegional: { kn: 'ವಿತರಣೆ ಮೊದಲು ಸಂಗ್ರಹಣೆ', hi: 'डिलीवरी से पहले स्टोरेज टिप्स' },
        description: 'How to keep produce fresh the night before drop-off.',
        thumbnailUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400',
        contentUrl: `## Pre-Delivery Storage Tips

### The Night Before
1. **Inspect your produce** - Remove any damaged items
2. **Clean gently** - Wipe off dirt, don't wash unless necessary
3. **Sort by size** - Similar sizes together for better grading

### Temperature Control
- Keep vegetables cool (not frozen)
- Avoid direct sunlight
- Use shade cloth if storing outdoors

### Morning of Delivery
- Check again for any overnight damage
- Pack carefully in clean crates
- Leave early to avoid heat

### What NOT to Do
- Don't stack too high
- Don't mix different vegetables
- Don't use wet containers`,
        readTimeMinutes: 4,
        language: 'en',
        cropTypes: ['TOMATO', 'ONION', 'POTATO'],
        categories: ['STORAGE'],
        qualityIssues: ['FRESHNESS_CONCERNS'],
        isFeatured: false,
    },

    // PHOTOGRAPHY category
    {
        type: 'VIDEO',
        title: 'Taking Better Photos for AI Grading',
        titleRegional: { kn: 'AI ಗ್ರೇಡಿಂಗ್‌ಗಾಗಿ ಉತ್ತಮ ಫೋಟೋಗಳು', hi: 'AI ग्रेडिंग के लिए बेहतर फोटो लेना' },
        description: 'Tips for capturing photos that help the AI accurately grade your produce.',
        thumbnailUrl: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400',
        contentUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        durationSeconds: 150,
        language: 'en',
        cropTypes: ['TOMATO', 'ONION', 'POTATO', 'CARROT'],
        categories: ['PHOTOGRAPHY'],
        qualityIssues: [],
        isFeatured: true,
    },
    {
        type: 'INFOGRAPHIC',
        title: 'Photo Lighting Guide',
        titleRegional: { kn: 'ಫೋಟೋ ಬೆಳಕಿನ ಮಾರ್ಗದರ್ಶಿ', hi: 'फोटो लाइटिंग गाइड' },
        description: 'Visual guide showing good vs bad lighting for produce photos.',
        thumbnailUrl: 'https://images.unsplash.com/photo-1542567455-cd733f23fbb1?w=400',
        contentUrl: 'https://images.unsplash.com/photo-1542567455-cd733f23fbb1?w=1200',
        language: 'en',
        cropTypes: [],
        categories: ['PHOTOGRAPHY'],
        qualityIssues: [],
        isFeatured: false,
    },

    // PACKAGING category
    {
        type: 'VIDEO',
        title: 'Proper Crate Loading Techniques',
        titleRegional: { kn: 'ಕ್ರೇಟ್ ಲೋಡಿಂಗ್ ತಂತ್ರಗಳು', hi: 'क्रेट लोडिंग तकनीक' },
        description: 'Learn to pack crates to prevent damage during transport.',
        thumbnailUrl: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400',
        contentUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        durationSeconds: 200,
        language: 'en',
        cropTypes: ['TOMATO', 'ONION', 'POTATO'],
        categories: ['PACKAGING'],
        qualityIssues: ['BRUISING', 'PACKAGING_PROBLEMS'],
        isFeatured: false,
    },
    {
        type: 'ARTICLE',
        title: 'Preparing Crates for Transport',
        titleRegional: { kn: 'ಸಾರಿಗೆಗಾಗಿ ಕ್ರೇಟ್‌ಗಳನ್ನು ತಯಾರಿಸುವುದು', hi: 'परिवहन के लिए क्रेट तैयार करना' },
        description: 'Step-by-step guide to prepare crates properly.',
        thumbnailUrl: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=400',
        contentUrl: `## Preparing Crates for Transport

### Before Packing
1. **Clean the crate** - Remove dirt and debris
2. **Check for damage** - No broken slats or sharp edges
3. **Line if needed** - Use newspaper or padding for delicate items

### Packing Layers
1. Place heaviest items at bottom
2. Layer with padding between rows
3. Don't overfill - leave 2cm gap at top
4. Arrange for air circulation

### Weight Distribution
- Maximum weight: 20kg per crate
- Even weight distribution
- Stack carefully (max 3 high)

### Common Mistakes
- Mixing wet and dry produce
- Overpacking crates
- Using damaged crates`,
        readTimeMinutes: 3,
        language: 'en',
        cropTypes: ['TOMATO', 'ONION', 'POTATO'],
        categories: ['PACKAGING'],
        qualityIssues: ['PACKAGING_PROBLEMS'],
        isFeatured: false,
    },

    // Size consistency
    {
        type: 'VIDEO',
        title: 'Sorting Produce by Size',
        titleRegional: { kn: 'ಗಾತ್ರದ ಪ್ರಕಾರ ವಿಂಗಡಿಸುವುದು', hi: 'आकार के अनुसार छंटाई' },
        description: 'Learn to sort your produce by size for better grades.',
        thumbnailUrl: 'https://images.unsplash.com/photo-1518977822534-7049a61ee0c2?w=400',
        contentUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        durationSeconds: 180,
        language: 'en',
        cropTypes: ['TOMATO', 'ONION', 'POTATO'],
        categories: ['GENERAL'],
        qualityIssues: ['SIZE_INCONSISTENCY'],
        isFeatured: false,
    },

    // Potato specific
    {
        type: 'ARTICLE',
        title: 'Potato Quality Standards Guide',
        titleRegional: { kn: 'ಆಲೂಗಡ್ಡೆ ಗುಣಮಟ್ಟ ಮಾನದಂಡಗಳು', hi: 'आलू गुणवत्ता मानक' },
        description: 'Understanding what buyers look for in potato quality.',
        thumbnailUrl: 'https://images.unsplash.com/photo-1518977676601-b53f82ber9eb?w=400',
        contentUrl: `## Potato Quality Standards

### Grade A Requirements
- Size: 50-80mm diameter
- No green spots
- No sprouting
- Smooth skin
- Firm texture

### Grade B Requirements
- Size: 40-90mm diameter
- Minor blemishes acceptable
- No major cuts

### Common Defects
1. **Green spots** - Light exposure
2. **Soft spots** - Storage issues
3. **Cuts/bruises** - Handling damage

### Improving Your Grade
- Harvest at right time
- Cure properly before storage
- Handle gently
- Store in dark, cool place`,
        readTimeMinutes: 4,
        language: 'en',
        cropTypes: ['POTATO'],
        categories: ['GENERAL'],
        qualityIssues: ['BRUISING', 'FRESHNESS_CONCERNS'],
        isFeatured: false,
    },

    // Carrot specific
    {
        type: 'VIDEO',
        title: 'Carrot Harvesting and Cleaning',
        titleRegional: { kn: 'ಕ್ಯಾರೆಟ್ ಕೊಯ್ಲು ಮತ್ತು ಸ್ವಚ್ಛಗೊಳಿಸುವಿಕೆ', hi: 'गाजर की कटाई और सफाई' },
        description: 'Best practices for harvesting and preparing carrots.',
        thumbnailUrl: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400',
        contentUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        durationSeconds: 220,
        language: 'en',
        cropTypes: ['CARROT'],
        categories: ['HARVEST', 'HANDLING'],
        qualityIssues: ['BRUISING'],
        isFeatured: false,
    },
];

async function seedEducationalContent(): Promise<void> {
    console.log('🌱 Seeding educational content...');

    // Clear existing content
    await prisma.contentBookmark.deleteMany();
    await prisma.contentView.deleteMany();
    await prisma.educationalContent.deleteMany();

    // Insert seed content
    for (const content of seedContent) {
        await prisma.educationalContent.create({
            data: {
                type: content.type,
                title: content.title,
                titleRegional: content.titleRegional ?? undefined,
                description: content.description,
                thumbnailUrl: content.thumbnailUrl,
                contentUrl: content.contentUrl,
                durationSeconds: content.durationSeconds || null,
                readTimeMinutes: content.readTimeMinutes || null,
                language: content.language,
                cropTypes: content.cropTypes,
                categories: content.categories,
                qualityIssues: content.qualityIssues,
                isFeatured: content.isFeatured,
                isActive: true,
            },
        });
    }

    console.log(`✅ Seeded ${seedContent.length} educational content items`);
}

// Run if executed directly
if (require.main === module) {
    seedEducationalContent()
        .then(() => {
            console.log('Seed complete!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Seed failed:', error);
            process.exit(1);
        })
        .finally(() => {
            prisma.$disconnect();
        });
}

export { seedEducationalContent };
