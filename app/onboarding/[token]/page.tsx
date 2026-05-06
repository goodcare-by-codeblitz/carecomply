'use client'

import { useEffect, useState, useRef, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Upload, 
  FileText, 
  X, 
  Loader2, 
  CheckCircle2, 
  Shield,
  Clock,
  AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { onboardingDocumentSchema } from '@/lib/validations'

interface Carer {
  id: string
  full_name: string
  email: string
  invite_expires_at: string
  organization_id: string
}

interface DocumentType {
  id: string
  name: string
  description: string | null
  is_required: boolean
  expiry_months: number | null
}

interface UploadedDoc {
  id: string
  document_type_id: string
  file_name: string
  status: string
  rejection_reason: string | null
}

export default function OnboardingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [carer, setCarer] = useState<Carer | null>(null)
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([])
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Upload state
  const [selectedType, setSelectedType] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createClient()
        
        // Fetch carer by token
        const { data: carerData, error: carerError } = await supabase
          .from('carers')
          .select('id, full_name, email, invite_expires_at, organization_id')
          .eq('invite_token', token)
          .single()

        if (carerError || !carerData) {
          setError('Invalid or expired link. Please contact your agency for a new link.')
          setLoading(false)
          return
        }

        // Check if token is expired
        if (new Date(carerData.invite_expires_at) < new Date()) {
          setError('This onboarding link has expired. Please contact your agency for a new link.')
          setLoading(false)
          return
        }

        setCarer(carerData)

        // Fetch document types for this organization
        const { data: docTypes } = await supabase
          .from('document_types')
          .select('*')
          .eq('organization_id', carerData.organization_id)
          .order('name')

        setDocumentTypes(docTypes || [])

        // Fetch already uploaded documents
        const { data: docs } = await supabase
          .from('documents')
          .select('id, document_type_id, file_name, status, rejection_reason')
          .eq('carer_id', carerData.id)

        setUploadedDocs(docs || [])
      } catch (err) {
        console.error(err)
        setError('Something went wrong. Please try again later.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [token])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      setFile(droppedFile)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
    }
  }

  const handleUpload = async () => {
    // Validate with Zod
    const result = onboardingDocumentSchema.safeParse({
      documentTypeId: selectedType,
      expiryDate: expiryDate || undefined,
    })

    if (!result.success) {
      const errors: Record<string, string> = {}
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0] as string] = err.message
        }
      })
      setValidationErrors(errors)
      return
    }

    if (!file) {
      toast.error('Please select a file to upload')
      return
    }

    if (!carer) return

    setIsUploading(true)
    setValidationErrors({})

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('carerId', carer.id)
      formData.append('documentTypeId', selectedType)
      formData.append('token', token)
      if (expiryDate) {
        formData.append('expiryDate', expiryDate)
      }

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const uploaded = await response.json()

      // Add to uploaded list
      setUploadedDocs(prev => [...prev, {
        id: uploaded.id,
        document_type_id: selectedType,
        file_name: file.name,
        status: 'pending',
      }])

      toast.success('Document uploaded successfully')
      setFile(null)
      setSelectedType('')
      setExpiryDate('')
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Failed to upload document')
    } finally {
      setIsUploading(false)
    }
  }

  const getDocTypeById = (id: string) => documentTypes.find(t => t.id === id)
  const isDocTypeUploaded = (id: string) => uploadedDocs.some(d => d.document_type_id === id && d.status !== 'rejected')
  const getDocStatus = (id: string) => uploadedDocs.find(d => d.document_type_id === id)
  const rejectedDocs = uploadedDocs.filter(d => d.status === 'rejected')
  const requiredTypes = documentTypes.filter(t => t.is_required)
  const uploadedRequiredCount = requiredTypes.filter(t => isDocTypeUploaded(t.id)).length
  const progress = requiredTypes.length > 0 
    ? Math.round((uploadedRequiredCount / requiredTypes.length) * 100) 
    : 0

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Link Not Valid</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Success state - all required docs uploaded
  if (progress === 100) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">All Documents Submitted</h2>
            <p className="text-muted-foreground mb-6">
              Thank you, {carer?.full_name}! You have successfully uploaded all required documents. Your agency will review them shortly.
            </p>
            <div className="bg-muted/50 rounded-lg p-4 text-left">
              <p className="text-sm font-medium mb-2">Documents submitted:</p>
              <ul className="space-y-2">
                {uploadedDocs.map((doc) => {
                  const docType = getDocTypeById(doc.document_type_id)
                  return (
                    <li key={doc.id} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span>{docType?.name || 'Document'}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3 mb-1">
            <Shield className="w-6 h-6 text-primary" />
            <span className="text-lg font-semibold">CareComply</span>
          </div>
          <p className="text-sm text-muted-foreground">Compliance Document Portal</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        {/* Welcome */}
        <div className="mb-10">
          <h1 className="text-2xl font-semibold tracking-tight mb-2">
            Welcome, {carer?.full_name}
          </h1>
          <p className="text-muted-foreground">
            Please upload your compliance documents below. Required documents are marked with an asterisk (*).
          </p>
        </div>

        {/* Rejected documents alert */}
        {rejectedDocs.length > 0 && (
          <Card className="mb-8 border-red-200 bg-red-50/50">
            <CardContent className="py-5">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-3">
                  <div>
                    <p className="font-medium text-red-800">Action Required</p>
                    <p className="text-sm text-red-700">
                      Some of your documents were rejected and need to be re-uploaded.
                    </p>
                  </div>
                  {rejectedDocs.map((doc) => {
                    const docType = getDocTypeById(doc.document_type_id)
                    return (
                      <div key={doc.id} className="bg-white rounded-lg p-3 border border-red-200">
                        <p className="text-sm font-medium text-red-800">{docType?.name}</p>
                        <p className="text-sm text-red-700 mt-1">{doc.rejection_reason}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Progress */}
        <Card className="mb-8">
          <CardContent className="py-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Your Progress</span>
              <span className="text-sm text-muted-foreground">
                {uploadedRequiredCount} of {requiredTypes.length} required documents
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Document list */}
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
              Required Documents
            </h2>
            {documentTypes.map((docType) => {
              const isUploaded = isDocTypeUploaded(docType.id)
              const docStatus = getDocStatus(docType.id)
              const isRejected = docStatus?.status === 'rejected'
              return (
                <div
                  key={docType.id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                    isRejected
                      ? 'bg-red-50/50 border-red-200'
                      : isUploaded 
                      ? 'bg-green-50/50 border-green-200' 
                      : 'bg-card hover:bg-muted/30'
                  )}
                >
                  {isRejected ? (
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                  ) : isUploaded ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {docType.name}
                      {docType.is_required && <span className="text-destructive ml-1">*</span>}
                    </p>
                    {isRejected ? (
                      <p className="text-xs text-red-600 mt-0.5">Needs re-upload</p>
                    ) : docType.expiry_months ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        Expires every {docType.expiry_months} months
                      </p>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Upload form */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-lg">Upload Document</CardTitle>
              <CardDescription>
                Select the document type and upload your file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Document type */}
              <div className="space-y-2">
                <Label>Document Type *</Label>
                <Select value={selectedType} onValueChange={(v) => {
                  setSelectedType(v)
                  setValidationErrors(prev => {
                    const next = { ...prev }
                    delete next.documentTypeId
                    return next
                  })
                }}>
                  <SelectTrigger className={cn('h-11', validationErrors.documentTypeId && 'border-destructive')}>
                    <SelectValue placeholder="Select document type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypes.filter(t => !isDocTypeUploaded(t.id) || getDocStatus(t.id)?.status === 'rejected').map((type) => {
                      const isRejected = getDocStatus(type.id)?.status === 'rejected'
                      return (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                          {type.is_required && ' *'}
                          {isRejected && ' (Re-upload)'}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                {validationErrors.documentTypeId && (
                  <p className="text-xs text-destructive">{validationErrors.documentTypeId}</p>
                )}
              </div>

              {/* Expiry date */}
              {selectedType && getDocTypeById(selectedType)?.expiry_months && (
                <div className="space-y-2">
                  <Label>Expiry Date</Label>
                  <Input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the expiry date shown on your document
                  </p>
                </div>
              )}

              {/* File drop zone */}
              <div className="space-y-2">
                <Label>File *</Label>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
                    isDragging 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-muted-foreground/50',
                    file && 'border-solid border-muted-foreground/30 bg-muted/30'
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileSelect}
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  />
                  
                  {file ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText className="w-10 h-10 text-muted-foreground" />
                      <div className="text-left">
                        <p className="text-sm font-medium truncate max-w-[200px]">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-2"
                        onClick={(e) => {
                          e.stopPropagation()
                          setFile(null)
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm font-medium">Drop your file here or click to browse</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Supports PDF, JPG, PNG, DOC (max 10MB)
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Upload button */}
              <Button 
                onClick={handleUpload} 
                className="w-full h-11"
                disabled={!file || !selectedType || isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Document
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
