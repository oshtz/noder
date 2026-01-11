/**
 * Workflow Templates for Quick Start
 * 
 * Each template defines a pre-configured workflow with nodes and edges
 */

export const workflowTemplates = [
  // ============ BEGINNER TEMPLATES ============
  // Simple workflows - standalone nodes with their own prompts, or simple LLM->Image chains
  
  // CHIP-DRIVEN: Character description flows to multiple image nodes
  {
    id: 'character-concept-sheet',
    name: 'Character Concept Sheet',
    description: 'Generate character full-body and portrait images from a single character description chip',
    icon: 'palette',
    category: 'beginner',
    nodes: [
      {
        id: 'chip-character',
        type: 'chip',
        position: { x: 100, y: 300 },
        style: { width: 280, height: 120 },
        data: {
          chipId: 'CHARACTER',
          content: 'elven ranger with silver braided hair and emerald eyes, wearing weathered dark green leather armor with silver leaf clasps, crescent moon scar on left cheek',
          executionOrder: 1
        }
      },
      {
        id: 'image-1',
        type: 'image',
        position: { x: 500, y: 100 },
        style: { width: 320, height: 427 },
        data: {
          prompt: 'Full-body character concept art, __CHARACTER__, longbow across back, dynamic three-quarter pose, neutral background, professional game art style, clean linework with painted rendering',
          aspect_ratio: '3:4',
          output_format: 'png',
          output_quality: 100,
          executionOrder: 2
        }
      },
      {
        id: 'image-2',
        type: 'image',
        position: { x: 500, y: 550 },
        style: { width: 320, height: 320 },
        data: {
          prompt: 'Character portrait headshot, __CHARACTER__, expressive face showing determination, dramatic side lighting, painterly digital art style, high detail on facial features, dialogue box portrait style',
          aspect_ratio: '1:1',
          output_format: 'png',
          output_quality: 100,
          executionOrder: 2
        }
      },
      {
        id: 'upscaler-1',
        type: 'upscaler',
        position: { x: 950, y: 100 },
        data: {
          scale: 4,
          executionOrder: 3
        }
      },
      {
        id: 'upscaler-2',
        type: 'upscaler',
        position: { x: 950, y: 550 },
        data: {
          scale: 4,
          executionOrder: 3
        }
      }
    ],
    edges: [
      {
        id: 'e-chip-image-1',
        source: 'chip-character',
        sourceHandle: 'out',
        target: 'image-1',
        targetHandle: 'in'
      },
      {
        id: 'e-chip-image-2',
        source: 'chip-character',
        sourceHandle: 'out',
        target: 'image-2',
        targetHandle: 'in'
      },
      {
        id: 'e-image-1-upscaler-1',
        source: 'image-1',
        sourceHandle: 'out',
        target: 'upscaler-1',
        targetHandle: 'in'
      },
      {
        id: 'e-image-2-upscaler-2',
        source: 'image-2',
        sourceHandle: 'out',
        target: 'upscaler-2',
        targetHandle: 'in'
      }
    ]
  },

  // LLM-DRIVEN: Text node generates prompt, image node receives it (empty prompt)
  {
    id: 'ai-prompt-to-image',
    name: 'AI Prompt Generator',
    description: 'Use an LLM to expand your idea into a detailed image prompt',
    icon: 'wand',
    category: 'beginner',
    nodes: [
      {
        id: 'text-1',
        type: 'text',
        position: { x: 100, y: 300 },
        data: {
          prompt: 'a cozy coffee shop on a rainy day',
          systemPrompt: 'You are an image prompt expert. Take the user\'s simple idea and expand it into a detailed, high-quality image generation prompt. Include: subject details, composition, lighting, mood, color palette, and art style. Maintain a strict non-conversational policy, output ONLY the prompt text, nothing else.',
          maxTokens: 512,
          executionOrder: 1
        }
      },
      {
        id: 'image-1',
        type: 'image',
        position: { x: 550, y: 300 },
        style: { width: 320, height: 320 },
        data: {
          prompt: '',
          aspect_ratio: '1:1',
          output_format: 'png',
          output_quality: 100,
          executionOrder: 2
        }
      }
    ],
    edges: [
      {
        id: 'e-text-1-image-1',
        source: 'text-1',
        sourceHandle: 'out',
        target: 'image-1',
        targetHandle: 'in'
      }
    ]
  },

  // CHIP-DRIVEN: Product description flows to multiple image nodes
  {
    id: 'product-photo-suite',
    name: 'Product Photo Suite',
    description: 'Generate hero and lifestyle product shots from a single product description chip',
    icon: 'comment',
    category: 'beginner',
    nodes: [
      {
        id: 'chip-product',
        type: 'chip',
        position: { x: 100, y: 300 },
        style: { width: 280, height: 100 },
        data: {
          chipId: 'PRODUCT',
          content: 'artisan ceramic coffee mug with speckled glaze',
          executionOrder: 1
        }
      },
      {
        id: 'image-1',
        type: 'image',
        position: { x: 500, y: 100 },
        style: { width: 320, height: 320 },
        data: {
          prompt: 'Premium product photography, __PRODUCT__ on marble surface, dramatic side lighting with soft shadows, steam rising from hot beverage, shallow depth of field, clean e-commerce style, studio shot on neutral gradient background',
          aspect_ratio: '1:1',
          output_format: 'png',
          output_quality: 100,
          executionOrder: 2
        }
      },
      {
        id: 'image-2',
        type: 'image',
        position: { x: 500, y: 550 },
        style: { width: 320, height: 320 },
        data: {
          prompt: 'Lifestyle product photography, __PRODUCT__ in cozy morning scene, rustic wooden table by window with rain outside, soft natural light, open book and reading glasses nearby, plants in background, aspirational home aesthetic, editorial style',
          aspect_ratio: '1:1',
          output_format: 'png',
          output_quality: 100,
          executionOrder: 2
        }
      },
      {
        id: 'upscaler-1',
        type: 'upscaler',
        position: { x: 950, y: 100 },
        data: {
          scale: 4,
          executionOrder: 3
        }
      },
      {
        id: 'upscaler-2',
        type: 'upscaler',
        position: { x: 950, y: 550 },
        data: {
          scale: 4,
          executionOrder: 3
        }
      }
    ],
    edges: [
      {
        id: 'e-chip-image-1',
        source: 'chip-product',
        sourceHandle: 'out',
        target: 'image-1',
        targetHandle: 'in'
      },
      {
        id: 'e-chip-image-2',
        source: 'chip-product',
        sourceHandle: 'out',
        target: 'image-2',
        targetHandle: 'in'
      },
      {
        id: 'e-image-1-upscaler-1',
        source: 'image-1',
        sourceHandle: 'out',
        target: 'upscaler-1',
        targetHandle: 'in'
      },
      {
        id: 'e-image-2-upscaler-2',
        source: 'image-2',
        sourceHandle: 'out',
        target: 'upscaler-2',
        targetHandle: 'in'
      }
    ]
  },

  // LLM-DRIVEN: Thumbnail generator
  {
    id: 'thumbnail-generator',
    name: 'Thumbnail Generator',
    description: 'AI generates a click-worthy thumbnail from your video topic',
    icon: 'video',
    category: 'beginner',
    nodes: [
      {
        id: 'text-1',
        type: 'text',
        position: { x: 100, y: 300 },
        data: {
          prompt: '5 productivity hacks that actually work',
          systemPrompt: 'You are a YouTube thumbnail expert. Create a detailed image prompt for a high-CTR thumbnail based on the video topic. Include: visual composition, colors (high contrast), text placement area, emotional hook, and style. Maintain a strict non-conversational policy, output ONLY the image prompt text, nothing else.',
          maxTokens: 512,
          executionOrder: 1
        }
      },
      {
        id: 'image-1',
        type: 'image',
        position: { x: 550, y: 300 },
        style: { width: 320, height: 180 },
        data: {
          prompt: '',
          aspect_ratio: '16:9',
          output_format: 'png',
          output_quality: 100,
          executionOrder: 2
        }
      }
    ],
    edges: [
      {
        id: 'e-text-1-image-1',
        source: 'text-1',
        sourceHandle: 'out',
        target: 'image-1',
        targetHandle: 'in'
      }
    ]
  },

  // ============ INTERMEDIATE TEMPLATES ============
  // Mix of standalone and LLM-driven workflows

  // CHIP-DRIVEN: Subject description flows to multiple editorial shots
  {
    id: 'editorial-photo-series',
    name: 'Editorial Photo Series',
    description: 'Three cohesive editorial shots from a single subject description chip',
    icon: 'balance',
    category: 'intermediate',
    nodes: [
      {
        id: 'chip-subject',
        type: 'chip',
        position: { x: 100, y: 450 },
        style: { width: 280, height: 100 },
        data: {
          chipId: 'SUBJECT',
          content: 'rose gold luxury watch with midnight blue dial',
          executionOrder: 1
        }
      },
      {
        id: 'image-1',
        type: 'image',
        position: { x: 500, y: 100 },
        style: { width: 320, height: 320 },
        data: {
          prompt: 'Luxury hero shot, __SUBJECT__ on black obsidian surface, dramatic chiaroscuro lighting, visible craftsmanship details, metal catching precise highlights, reflection on polished surface, Patek Philippe advertisement quality',
          aspect_ratio: '1:1',
          output_format: 'png',
          output_quality: 100,
          executionOrder: 2
        }
      },
      {
        id: 'image-2',
        type: 'image',
        position: { x: 500, y: 550 },
        style: { width: 320, height: 320 },
        data: {
          prompt: 'Macro detail shot, extreme close-up of __SUBJECT__, visible texture and finishing, shallow depth of field, museum-quality documentation style, technical perfection',
          aspect_ratio: '1:1',
          output_format: 'png',
          output_quality: 100,
          executionOrder: 2
        }
      },
      {
        id: 'image-3',
        type: 'image',
        position: { x: 500, y: 1000 },
        style: { width: 320, height: 240 },
        data: {
          prompt: 'Lifestyle editorial photo, __SUBJECT__ on wrist of person in tailored navy suit, candid moment at upscale event, champagne glass nearby, warm ambient lighting, sophisticated social setting, aspirational wealth aesthetic',
          aspect_ratio: '4:3',
          output_format: 'png',
          output_quality: 100,
          executionOrder: 2
        }
      },
      {
        id: 'upscaler-1',
        type: 'upscaler',
        position: { x: 950, y: 100 },
        data: {
          scale: 4,
          executionOrder: 3
        }
      }
    ],
    edges: [
      {
        id: 'e-chip-image-1',
        source: 'chip-subject',
        sourceHandle: 'out',
        target: 'image-1',
        targetHandle: 'in'
      },
      {
        id: 'e-chip-image-2',
        source: 'chip-subject',
        sourceHandle: 'out',
        target: 'image-2',
        targetHandle: 'in'
      },
      {
        id: 'e-chip-image-3',
        source: 'chip-subject',
        sourceHandle: 'out',
        target: 'image-3',
        targetHandle: 'in'
      },
      {
        id: 'e-image-1-upscaler-1',
        source: 'image-1',
        sourceHandle: 'out',
        target: 'upscaler-1',
        targetHandle: 'in'
      }
    ]
  },

  // LLM-DRIVEN: Album art from music description
  {
    id: 'album-art-generator',
    name: 'Album Art Generator',
    description: 'AI creates album artwork from your music description',
    icon: 'music',
    category: 'intermediate',
    nodes: [
      {
        id: 'text-1',
        type: 'text',
        position: { x: 100, y: 300 },
        data: {
          prompt: 'dreamy indie electronic, melancholic synths, late night city drives, influenced by Tycho and Bonobo',
          systemPrompt: 'You are an album cover designer. Create a detailed image prompt for album artwork that captures the music\'s mood and genre. Include: visual concept, color palette, composition, style (abstract, photographic, illustrated), and mood. Maintain a strict non-conversational policy, output ONLY the image prompt text, nothing else.',
          maxTokens: 512,
          executionOrder: 1
        }
      },
      {
        id: 'image-1',
        type: 'image',
        position: { x: 550, y: 300 },
        style: { width: 320, height: 320 },
        data: {
          prompt: '',
          aspect_ratio: '1:1',
          output_format: 'png',
          output_quality: 100,
          executionOrder: 2
        }
      },
      {
        id: 'upscaler-1',
        type: 'upscaler',
        position: { x: 1000, y: 300 },
        data: {
          scale: 4,
          executionOrder: 3
        }
      }
    ],
    edges: [
      {
        id: 'e-text-1-image-1',
        source: 'text-1',
        sourceHandle: 'out',
        target: 'image-1',
        targetHandle: 'in'
      },
      {
        id: 'e-image-1-upscaler-1',
        source: 'image-1',
        sourceHandle: 'out',
        target: 'upscaler-1',
        targetHandle: 'in'
      }
    ]
  },

  // CHIP-DRIVEN: Environment description flows to multiple concept art shots
  {
    id: 'game-environment-kit',
    name: 'Game Environment Kit',
    description: 'Environment concept art from a single environment description chip',
    icon: 'seedling',
    category: 'intermediate',
    nodes: [
      {
        id: 'chip-environment',
        type: 'chip',
        position: { x: 100, y: 450 },
        style: { width: 280, height: 120 },
        data: {
          chipId: 'ENVIRONMENT',
          content: 'abandoned space station corridor overgrown with bioluminescent alien plants, broken panels revealing organic growth',
          executionOrder: 1
        }
      },
      {
        id: 'image-1',
        type: 'image',
        position: { x: 500, y: 100 },
        style: { width: 320, height: 180 },
        data: {
          prompt: 'Game environment concept art, __ENVIRONMENT__, emergency lights flickering through fog, cinematic wide establishing shot, AAA game quality, painted concept art style',
          aspect_ratio: '16:9',
          output_format: 'png',
          output_quality: 100,
          executionOrder: 2
        }
      },
      {
        id: 'image-2',
        type: 'image',
        position: { x: 500, y: 550 },
        style: { width: 320, height: 320 },
        data: {
          prompt: 'Environment detail shot, close-up of __ENVIRONMENT__, tendrils wrapping around buttons and screens, juxtaposition of organic and technological, eerie bioluminescent glow, texture reference quality, game asset documentation style',
          aspect_ratio: '1:1',
          output_format: 'png',
          output_quality: 100,
          executionOrder: 2
        }
      },
      {
        id: 'image-3',
        type: 'image',
        position: { x: 500, y: 1000 },
        style: { width: 320, height: 213 },
        data: {
          prompt: 'Game props concept sheet for __ENVIRONMENT__, sci-fi horror items on white background: damaged computer terminal, alien egg sac, broken containment tube, emergency supply crate, withered space suit, clean presentation, labeled prop designs for 3D artists',
          aspect_ratio: '3:2',
          output_format: 'png',
          output_quality: 100,
          executionOrder: 2
        }
      },
      {
        id: 'upscaler-1',
        type: 'upscaler',
        position: { x: 950, y: 100 },
        data: {
          scale: 4,
          executionOrder: 3
        }
      }
    ],
    edges: [
      {
        id: 'e-chip-image-1',
        source: 'chip-environment',
        sourceHandle: 'out',
        target: 'image-1',
        targetHandle: 'in'
      },
      {
        id: 'e-chip-image-2',
        source: 'chip-environment',
        sourceHandle: 'out',
        target: 'image-2',
        targetHandle: 'in'
      },
      {
        id: 'e-chip-image-3',
        source: 'chip-environment',
        sourceHandle: 'out',
        target: 'image-3',
        targetHandle: 'in'
      },
      {
        id: 'e-image-1-upscaler-1',
        source: 'image-1',
        sourceHandle: 'out',
        target: 'upscaler-1',
        targetHandle: 'in'
      }
    ]
  },

  // LLM-DRIVEN: Brand photography from concept
  {
    id: 'brand-photo-generator',
    name: 'Brand Photo Generator',
    description: 'AI creates brand photography from your brand description',
    icon: 'book',
    category: 'intermediate',
    nodes: [
      {
        id: 'text-1',
        type: 'text',
        position: { x: 100, y: 300 },
        data: {
          prompt: 'sustainable outdoor apparel brand for eco-conscious adventurers, earth tones, authentic not polished, Patagonia meets REI',
          systemPrompt: 'You are a brand photographer. Create a detailed image prompt for aspirational brand photography. Include: scene/setting, subjects, lighting, color grading, mood, and style reference. Maintain a strict non-conversational policy, output ONLY the image prompt text, nothing else.',
          maxTokens: 512,
          executionOrder: 1
        }
      },
      {
        id: 'image-1',
        type: 'image',
        position: { x: 550, y: 300 },
        style: { width: 320, height: 213 },
        data: {
          prompt: '',
          aspect_ratio: '3:2',
          output_format: 'png',
          output_quality: 100,
          executionOrder: 2
        }
      }
    ],
    edges: [
      {
        id: 'e-text-1-image-1',
        source: 'text-1',
        sourceHandle: 'out',
        target: 'image-1',
        targetHandle: 'in'
      }
    ]
  },

  // ============ ADVANCED TEMPLATES ============
  // Complex workflows showing both patterns

  // CHIP-DRIVEN: Character description flows to all storyboard frames
  {
    id: 'storyboard-sequence',
    name: 'Storyboard Sequence',
    description: 'Four-frame storyboard with consistent character from a chip',
    icon: 'rocket',
    category: 'advanced',
    nodes: [
      {
        id: 'chip-character',
        type: 'chip',
        position: { x: 100, y: 500 },
        style: { width: 280, height: 120 },
        data: {
          chipId: 'CHARACTER',
          content: 'elderly woman with silver hair and weathered hands, former NASA radio operator, wearing faded vintage cardigan',
          executionOrder: 1
        }
      },
      {
        id: 'image-1',
        type: 'image',
        position: { x: 500, y: 100 },
        style: { width: 320, height: 137 },
        data: {
          prompt: 'Storyboard frame, wide establishing shot, __CHARACTER__ alone in modest apartment, walls covered with faded space mission memorabilia, morning light through dusty blinds, melancholic isolation, desaturated color palette, cinematic 2.39:1 aspect ratio feel',
          aspect_ratio: '21:9',
          output_format: 'png',
          output_quality: 100,
          executionOrder: 2
        }
      },
      {
        id: 'image-2',
        type: 'image',
        position: { x: 500, y: 350 },
        style: { width: 320, height: 137 },
        data: {
          prompt: 'Storyboard frame, close-up shot, vintage radio equipment crackling to life, green LED lights reflecting in wide eyes of __CHARACTER__, tension and disbelief, Dutch angle, noir lighting with dramatic shadows, Interstellar cinematography style',
          aspect_ratio: '21:9',
          output_format: 'png',
          output_quality: 100,
          executionOrder: 2
        }
      },
      {
        id: 'image-3',
        type: 'image',
        position: { x: 500, y: 600 },
        style: { width: 320, height: 137 },
        data: {
          prompt: 'Storyboard frame, epic wide shot, __CHARACTER__ standing before massive radio telescope at night, stars wheeling overhead, small figure against cosmic scale, spiritual and awe-inspiring, Spielbergian wonder, backlit silhouette',
          aspect_ratio: '21:9',
          output_format: 'png',
          output_quality: 100,
          executionOrder: 2
        }
      },
      {
        id: 'image-4',
        type: 'image',
        position: { x: 500, y: 850 },
        style: { width: 320, height: 137 },
        data: {
          prompt: 'Storyboard frame, intimate close-up, __CHARACTER__ face wearing headphones, single tear, expression of peace and closure, soft warm lighting suggesting dawn, emotional catharsis, handheld feeling, Moon movie aesthetic',
          aspect_ratio: '21:9',
          output_format: 'png',
          output_quality: 100,
          executionOrder: 2
        }
      },
      {
        id: 'upscaler-1',
        type: 'upscaler',
        position: { x: 950, y: 700 },
        data: {
          scale: 4,
          executionOrder: 3
        }
      }
    ],
    edges: [
      {
        id: 'e-chip-image-1',
        source: 'chip-character',
        sourceHandle: 'out',
        target: 'image-1',
        targetHandle: 'in'
      },
      {
        id: 'e-chip-image-2',
        source: 'chip-character',
        sourceHandle: 'out',
        target: 'image-2',
        targetHandle: 'in'
      },
      {
        id: 'e-chip-image-3',
        source: 'chip-character',
        sourceHandle: 'out',
        target: 'image-3',
        targetHandle: 'in'
      },
      {
        id: 'e-chip-image-4',
        source: 'chip-character',
        sourceHandle: 'out',
        target: 'image-4',
        targetHandle: 'in'
      },
      {
        id: 'e-image-3-upscaler-1',
        source: 'image-3',
        sourceHandle: 'out',
        target: 'upscaler-1',
        targetHandle: 'in'
      }
    ]
  },

  // LLM-DRIVEN: Single prompt generates variations
  {
    id: 'concept-variations',
    name: 'Concept Variations',
    description: 'AI expands your idea into multiple image variations',
    icon: 'layers',
    category: 'advanced',
    nodes: [
      {
        id: 'text-1',
        type: 'text',
        position: { x: 100, y: 400 },
        data: {
          prompt: 'a magical library with floating books',
          systemPrompt: 'You are an image prompt expert. Take the user\'s concept and create a detailed, evocative image prompt. Include rich visual details: lighting, atmosphere, composition, color palette, and artistic style. Maintain a strict non-conversational policy, output ONLY the prompt text, nothing else.',
          maxTokens: 512,
          executionOrder: 1
        }
      },
      {
        id: 'image-1',
        type: 'image',
        position: { x: 550, y: 100 },
        style: { width: 320, height: 320 },
        data: {
          prompt: '',
          aspect_ratio: '1:1',
          output_format: 'png',
          output_quality: 100,
          executionOrder: 2
        }
      },
      {
        id: 'image-2',
        type: 'image',
        position: { x: 550, y: 550 },
        style: { width: 320, height: 320 },
        data: {
          prompt: '',
          aspect_ratio: '1:1',
          output_format: 'png',
          output_quality: 100,
          executionOrder: 2
        }
      },
      {
        id: 'image-3',
        type: 'image',
        position: { x: 550, y: 1000 },
        style: { width: 320, height: 320 },
        data: {
          prompt: '',
          aspect_ratio: '1:1',
          output_format: 'png',
          output_quality: 100,
          executionOrder: 2
        }
      }
    ],
    edges: [
      {
        id: 'e-text-1-image-1',
        source: 'text-1',
        sourceHandle: 'out',
        target: 'image-1',
        targetHandle: 'in'
      },
      {
        id: 'e-text-1-image-2',
        source: 'text-1',
        sourceHandle: 'out',
        target: 'image-2',
        targetHandle: 'in'
      },
      {
        id: 'e-text-1-image-3',
        source: 'text-1',
        sourceHandle: 'out',
        target: 'image-3',
        targetHandle: 'in'
      }
    ]
  },

  // MIXED: Some standalone, some connected - demonstrating both in one workflow
  {
    id: 'brand-campaign-mixed',
    name: 'Brand Campaign',
    description: 'AI hero image + standalone supporting shots',
    icon: 'star',
    category: 'advanced',
    nodes: [
      // LLM-driven hero image
      {
        id: 'text-1',
        type: 'text',
        position: { x: 100, y: 100 },
        data: {
          prompt: 'premium plant-based restaurant, natural materials, warm earth tones, Kinfolk magazine aesthetic',
          systemPrompt: 'You are a food/lifestyle photographer. Create a hero image prompt for this restaurant brand. Include: dish presentation, setting, lighting, mood, and style. Maintain a strict non-conversational policy, output ONLY the prompt text, nothing else.',
          maxTokens: 512,
          executionOrder: 1
        }
      },
      {
        id: 'image-1',
        type: 'image',
        position: { x: 550, y: 100 },
        style: { width: 320, height: 320 },
        data: {
          prompt: '',
          aspect_ratio: '1:1',
          output_format: 'png',
          output_quality: 100,
          executionOrder: 2
        }
      },
      // Standalone supporting images (not connected to LLM)
      {
        id: 'image-2',
        type: 'image',
        position: { x: 550, y: 550 },
        style: { width: 320, height: 213 },
        data: {
          prompt: 'Restaurant interior mood shot, natural materials and living plant wall, dappled sunlight through windows, empty table set for service, premium but welcoming atmosphere, architectural digest quality, warm earth tones',
          aspect_ratio: '3:2',
          output_format: 'png',
          output_quality: 100,
          executionOrder: 1
        }
      },
      {
        id: 'image-3',
        type: 'image',
        position: { x: 550, y: 900 },
        style: { width: 320, height: 320 },
        data: {
          prompt: 'Brand pattern tile, botanical line art illustration, repeating leaf and herb motifs, elegant and minimal, suitable for packaging and menus, single color on cream background, William Morris meets modern minimalism, seamless repeat',
          aspect_ratio: '1:1',
          output_format: 'png',
          output_quality: 100,
          executionOrder: 1
        }
      },
      {
        id: 'upscaler-1',
        type: 'upscaler',
        position: { x: 1000, y: 100 },
        data: {
          scale: 4,
          executionOrder: 3
        }
      }
    ],
    edges: [
      {
        id: 'e-text-1-image-1',
        source: 'text-1',
        sourceHandle: 'out',
        target: 'image-1',
        targetHandle: 'in'
      },
      {
        id: 'e-image-1-upscaler-1',
        source: 'image-1',
        sourceHandle: 'out',
        target: 'upscaler-1',
        targetHandle: 'in'
      }
    ]
  },

  // CHIP-DRIVEN: Character and style flow to all animation keyframes
  {
    id: 'animation-keyframes',
    name: 'Animation Keyframes',
    description: 'Sequential animation frames with consistent character and style from chips',
    icon: 'film',
    category: 'advanced',
    nodes: [
      {
        id: 'chip-character',
        type: 'chip',
        position: { x: 100, y: 350 },
        style: { width: 280, height: 100 },
        data: {
          chipId: 'CHARACTER',
          content: 'origami paper crane with delicate folds, expressive paper wings',
          executionOrder: 1
        }
      },
      {
        id: 'chip-style',
        type: 'chip',
        position: { x: 100, y: 550 },
        style: { width: 280, height: 80 },
        data: {
          chipId: 'STYLE',
          content: 'Pixar 3D style, whimsical and heartwarming, soft magical lighting',
          executionOrder: 1
        }
      },
      {
        id: 'image-1',
        type: 'image',
        position: { x: 500, y: 100 },
        style: { width: 320, height: 180 },
        data: {
          prompt: 'Animation keyframe, __STYLE__, __CHARACTER__ on desk in moonlit bedroom, first flutter of movement, magical sparkles appearing, child sleeping in background soft focus, soft blue moonlight, wide establishing shot',
          aspect_ratio: '16:9',
          output_format: 'png',
          output_quality: 100,
          executionOrder: 2
        }
      },
      {
        id: 'image-2',
        type: 'image',
        position: { x: 500, y: 350 },
        style: { width: 320, height: 180 },
        data: {
          prompt: 'Animation keyframe, __STYLE__, __CHARACTER__ taking first wobbly flight, wings catching moonlight, expression of wonder and curiosity, bedroom objects looming large below, low angle dynamic shot',
          aspect_ratio: '16:9',
          output_format: 'png',
          output_quality: 100,
          executionOrder: 2
        }
      },
      {
        id: 'image-3',
        type: 'image',
        position: { x: 500, y: 600 },
        style: { width: 320, height: 180 },
        data: {
          prompt: 'Animation keyframe, __STYLE__, __CHARACTER__ discovering snow globe on shelf, peering into miniature world with amazement, reflection of tiny village in its paper eye, intimate close-up, warm practical light from globe',
          aspect_ratio: '16:9',
          output_format: 'png',
          output_quality: 100,
          executionOrder: 2
        }
      },
      {
        id: 'image-4',
        type: 'image',
        position: { x: 500, y: 850 },
        style: { width: 320, height: 180 },
        data: {
          prompt: 'Animation keyframe, __STYLE__, __CHARACTER__ settling on sleeping child pillow, protective pose watching over them, first light of dawn through window, tender and peaceful, warm golden tones emerging, emotional resolution',
          aspect_ratio: '16:9',
          output_format: 'png',
          output_quality: 100,
          executionOrder: 2
        }
      }
    ],
    edges: [
      {
        id: 'e-chip-char-image-1',
        source: 'chip-character',
        sourceHandle: 'out',
        target: 'image-1',
        targetHandle: 'in'
      },
      {
        id: 'e-chip-char-image-2',
        source: 'chip-character',
        sourceHandle: 'out',
        target: 'image-2',
        targetHandle: 'in'
      },
      {
        id: 'e-chip-char-image-3',
        source: 'chip-character',
        sourceHandle: 'out',
        target: 'image-3',
        targetHandle: 'in'
      },
      {
        id: 'e-chip-char-image-4',
        source: 'chip-character',
        sourceHandle: 'out',
        target: 'image-4',
        targetHandle: 'in'
      },
      {
        id: 'e-chip-style-image-1',
        source: 'chip-style',
        sourceHandle: 'out',
        target: 'image-1',
        targetHandle: 'in'
      },
      {
        id: 'e-chip-style-image-2',
        source: 'chip-style',
        sourceHandle: 'out',
        target: 'image-2',
        targetHandle: 'in'
      },
      {
        id: 'e-chip-style-image-3',
        source: 'chip-style',
        sourceHandle: 'out',
        target: 'image-3',
        targetHandle: 'in'
      },
      {
        id: 'e-chip-style-image-4',
        source: 'chip-style',
        sourceHandle: 'out',
        target: 'image-4',
        targetHandle: 'in'
      }
    ]
  }
];

/**
 * Validate all templates for common issues
 * Returns an array of issue strings, empty if all valid
 */
export const validateTemplates = () => {
  const issues = [];
  const ids = workflowTemplates.map(t => t.id);
  
  // Check for duplicate IDs
  const duplicateIds = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (duplicateIds.length) {
    issues.push(`Duplicate template IDs: ${duplicateIds.join(', ')}`);
  }
  
  workflowTemplates.forEach(template => {
    const nodeIds = template.nodes.map(n => n.id);
    
    // Check for duplicate node IDs within template
    const duplicateNodeIds = nodeIds.filter((id, i) => nodeIds.indexOf(id) !== i);
    if (duplicateNodeIds.length) {
      issues.push(`${template.id}: duplicate node IDs: ${duplicateNodeIds.join(', ')}`);
    }
    
    // Check for orphan nodes (nodes not connected when edges exist)
    if (template.edges.length > 0) {
      const connectedNodes = new Set([
        ...template.edges.map(e => e.source),
        ...template.edges.map(e => e.target)
      ]);
      const orphans = template.nodes.filter(n => !connectedNodes.has(n.id));
      if (orphans.length) {
        issues.push(`${template.id}: orphan nodes not connected: ${orphans.map(n => n.id).join(', ')}`);
      }
    }
    
    // Check for edges referencing non-existent nodes
    template.edges.forEach(edge => {
      if (!nodeIds.includes(edge.source)) {
        issues.push(`${template.id}: edge references non-existent source: ${edge.source}`);
      }
      if (!nodeIds.includes(edge.target)) {
        issues.push(`${template.id}: edge references non-existent target: ${edge.target}`);
      }
    });
    
    // Check for missing required fields
    if (!template.name) issues.push(`${template.id}: missing name`);
    if (!template.description) issues.push(`${template.id}: missing description`);
    if (!template.category) issues.push(`${template.id}: missing category`);
    if (!template.nodes || template.nodes.length === 0) {
      issues.push(`${template.id}: no nodes defined`);
    }
  });
  
  return issues;
};

/**
 * Get template by ID
 */
export const getTemplateById = (id) => {
  return workflowTemplates.find(template => template.id === id);
};

/**
 * Get templates by category
 */
export const getTemplatesByCategory = (category) => {
  return workflowTemplates.filter(template => template.category === category);
};

/**
 * Apply a template to the workflow
 * This function creates the nodes and edges from a template
 */
/**
 * Calculate node dimensions based on image aspect ratio
 * Supports both width/height numbers and aspect_ratio strings (e.g., "16:9")
 */
const calculateNodeSizeFromAspectRatio = (widthOrRatio, height, baseWidth = 360) => {
  let aspectRatio;

  // Handle aspect_ratio string format (e.g., "16:9", "1:1")
  if (typeof widthOrRatio === 'string' && widthOrRatio.includes(':')) {
    const [w, h] = widthOrRatio.split(':').map(Number);
    if (w && h) {
      aspectRatio = w / h;
    }
  } else if (typeof widthOrRatio === 'number' && typeof height === 'number') {
    // Handle width/height numbers
    aspectRatio = widthOrRatio / height;
  }

  if (!aspectRatio) return { width: baseWidth, height: 300 };

  const nodeHeight = Math.round(baseWidth / aspectRatio);

  // Clamp height to reasonable bounds
  const clampedHeight = Math.max(200, Math.min(600, nodeHeight));

  return { width: baseWidth, height: clampedHeight };
};

export const applyTemplate = (template, handleRemoveNode) => {
  if (!template) return { nodes: [], edges: [] };

  const templateNodeStyle = { width: 360, height: 300 };

  // Deep clone the template data to avoid mutations
  const nodes = template.nodes.map(node => {
    // For image/video nodes, calculate size based on aspect ratio from data
    let nodeStyle = node.style ? { ...node.style } : { ...templateNodeStyle };

    if ((node.type === 'image' || node.type === 'video')) {
      // Support both aspect_ratio string and width/height numbers
      if (node.data?.aspect_ratio) {
        nodeStyle = calculateNodeSizeFromAspectRatio(node.data.aspect_ratio);
      } else if (node.data?.width && node.data?.height) {
        nodeStyle = calculateNodeSizeFromAspectRatio(node.data.width, node.data.height);
      }
    }

    return {
      ...node,
      style: nodeStyle,
      data: {
        ...node.data,
        onRemove: handleRemoveNode
      }
    };
  });

  const edges = template.edges.map(edge => ({
    ...edge,
    animated: false,
    data: {
      isProcessing: false
    }
  }));

  return { nodes, edges };
};

