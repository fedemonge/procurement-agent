import { z } from 'zod'

export const SearchRequestSchema = z.object({
  description: z.string().min(5, 'Please describe what you need (at least 5 characters)'),
  brandOrSku: z.string().optional(),
  location: z.string().min(2, 'Please enter a city or country'),
  incoterm: z.string().optional(),
  attachments: z.array(z.object({
    base64: z.string(),
    mimeType: z.string(),
    name: z.string(),
  })).optional(),
})

export const EmailRequestSchema = z.object({
  userName: z.string().min(1, 'Your name is required'),
  userEmail: z.string().email('Please enter a valid email address'),
  searchRequest: SearchRequestSchema,
  suppliers: z.array(z.object({
    name: z.string(),
    address: z.string(),
    country: z.string(),
    website: z.string(),
    catalogUrl: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    productDetails: z.string(),
    rating: z.string().optional(),
    ratingSource: z.string().optional(),
    incotermsSupported: z.array(z.string()).optional(),
    notes: z.string().optional(),
  })),
})
