export interface SupplierResult {
  name: string
  address: string
  country: string
  website: string
  catalogUrl?: string
  phone?: string
  email?: string
  productDetails: string
  rating?: string
  ratingSource?: string
  incotermsSupported?: string[]
  notes?: string
}

export interface SearchRequest {
  description: string
  brandOrSku?: string
  location: string
  incoterm?: string
  imageBase64?: string
  imageMimeType?: string
}

export interface SearchResponse {
  suppliers: SupplierResult[]
  searchId: string
  query: string
}

export interface EmailRequest {
  userName: string
  userEmail: string
  searchRequest: SearchRequest
  suppliers: SupplierResult[]
}
