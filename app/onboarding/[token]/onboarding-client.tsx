'use client';

import { PersonDetailsForm } from '@/components/carer-profile-card';
import { cn } from '@/lib/utils';
import { onboardingDocumentSchema } from '@/lib/validations';
import type { PersonDetailsInput } from '@/lib/person-profile';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Upload,
  X,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Logo } from '@/components/marketing/logo';

type Carer = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  county: string | null;
  postcode: string | null;
  emergency_contact_name: string | null;
  emergency_contact_relationship: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_email: string | null;
  onboarding_progress: number | null;
};

type Organization = {
  name: string;
  slug: string;
  required_work_references_count?: number | null;
  required_character_references_count?: number | null;
} | null;

type DocumentType = {
  id: string;
  name: string;
  description: string | null;
  is_required: boolean;
  expiry_months: number | null;
};

type UploadedDoc = {
  id: string;
  document_type_id: string;
  file_name: string;
  file_size: number | null;
  status: string;
  expiry_date: string | null;
  uploaded_at: string;
  rejection_reason: string | null;
};

type ReferenceRow = {
  id?: string;
  fullName: string;
  organization: string;
  email: string;
  phone: string;
  relationship: string;
  notes: string;
  referenceType: 'work' | 'character';
};

type ApiReference = {
  id: string;
  full_name: string;
  organization: string | null;
  email: string;
  phone: string;
  relationship: string;
  notes: string | null;
  reference_type: string;
};

type OnboardingPayload = {
  organization: Organization;
  carer: Carer;
  documentTypes: DocumentType[];
  documents: UploadedDoc[];
  references: ApiReference[];
};

const emptyReference = (referenceType: 'work' | 'character'): ReferenceRow => ({
  fullName: '',
  organization: '',
  email: '',
  phone: '',
  relationship: '',
  notes: '',
  referenceType,
});

function mapApiRef(ref: ApiReference, referenceType: 'work' | 'character'): ReferenceRow {
  return {
    id: ref.id,
    fullName: ref.full_name,
    organization: ref.organization ?? '',
    email: ref.email,
    phone: ref.phone,
    relationship: ref.relationship,
    notes: ref.notes ?? '',
    referenceType,
  };
}

function isDocumentUnexpired(document: Pick<UploadedDoc, 'expiry_date'>) {
  if (!document.expiry_date) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryDate = new Date(document.expiry_date);
  expiryDate.setHours(0, 0, 0, 0);
  return expiryDate >= today;
}

// Shared input class
const inputCls = 'w-full h-10 rounded-lg border border-line-strong bg-white px-3 text-[14px] text-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition';
const textareaCls = 'w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-[14px] text-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition resize-none';

export function OnboardingClient() {
  const { token } = useParams<{ token: string }>();
  const [carer, setCarer] = useState<Carer | null>(null);
  const [carerPhone, setCarerPhone] = useState('');
  const [profileForm, setProfileForm] = useState<PersonDetailsInput>({
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    county: '',
    postcode: '',
    emergencyContactName: '',
    emergencyContactRelationship: '',
    emergencyContactPhone: '',
    emergencyContactEmail: '',
  });
  const [organization, setOrganization] = useState<Organization>(null);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [workReferences, setWorkReferences] = useState<ReferenceRow[]>([]);
  const [characterReferences, setCharacterReferences] = useState<ReferenceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedType, setSelectedType] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingWorkRefs, setIsSavingWorkRefs] = useState(false);
  const [isSavingCharRefs, setIsSavingCharRefs] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadOnboarding = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/onboarding/details?token=${encodeURIComponent(token)}`);
      const payload = (await response.json()) as OnboardingPayload | { error?: string };

      if (!response.ok) {
        const errorPayload = payload as { error?: string };
        setError(errorPayload.error ?? 'This onboarding link is not valid.');
        return;
      }

      const data = payload as OnboardingPayload;
      const reqWork = data.organization?.required_work_references_count ?? 0;
      const reqChar = data.organization?.required_character_references_count ?? 0;
      const savedWork = data.references.filter((r) => r.reference_type === 'work');
      const savedChar = data.references.filter((r) => r.reference_type === 'character');

      setCarer(data.carer);
      setCarerPhone(data.carer.phone ?? '');
      setProfileForm({
        phone: data.carer.phone ?? '',
        addressLine1: data.carer.address_line1 ?? '',
        addressLine2: data.carer.address_line2 ?? '',
        city: data.carer.city ?? '',
        county: data.carer.county ?? '',
        postcode: data.carer.postcode ?? '',
        emergencyContactName: data.carer.emergency_contact_name ?? '',
        emergencyContactRelationship: data.carer.emergency_contact_relationship ?? '',
        emergencyContactPhone: data.carer.emergency_contact_phone ?? '',
        emergencyContactEmail: data.carer.emergency_contact_email ?? '',
      });
      setOrganization(data.organization);
      setDocumentTypes(data.documentTypes);
      setUploadedDocs(data.documents);
      setWorkReferences(
        Array.from({ length: reqWork }, (_, i) =>
          savedWork[i] ? mapApiRef(savedWork[i], 'work') : emptyReference('work'),
        ),
      );
      setCharacterReferences(
        Array.from({ length: reqChar }, (_, i) =>
          savedChar[i] ? mapApiRef(savedChar[i], 'character') : emptyReference('character'),
        ),
      );
    } catch (err) {
      console.error(err);
      setError('Something went wrong. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadOnboarding(); }, [loadOnboarding]);

  const documentsByType = uploadedDocs.reduce<Record<string, UploadedDoc[]>>(
    (groups, doc) => {
      if (doc.status === 'obsolete') return groups;
      groups[doc.document_type_id] = groups[doc.document_type_id] ?? [];
      groups[doc.document_type_id].push(doc);
      return groups;
    },
    {},
  );
  const getDocTypeById = (id: string) => documentTypes.find((type) => type.id === id);
  const getDocsForType = (id: string) => documentsByType[id] ?? [];
  const getEffectiveDocStatus = (id: string) => {
    const docs = getDocsForType(id);
    const approvedDoc = docs.find((doc) => doc.status === 'approved' && isDocumentUnexpired(doc));
    if (approvedDoc) return approvedDoc;
    return docs.find((doc) => doc.status !== 'rejected') ?? docs[0] ?? null;
  };
  const isDocTypeCompliant = (id: string) =>
    getDocsForType(id).some((doc) => doc.status === 'approved' && isDocumentUnexpired(doc));
  const isDocTypeSubmitted = (id: string) =>
    getDocsForType(id).some((doc) => doc.status === 'pending');

  const rejectedDocs = uploadedDocs.filter((doc) => doc.status === 'rejected');
  const requiredTypes = documentTypes.filter((type) => type.is_required);
  const uploadedRequiredCount = requiredTypes.filter((type) => isDocTypeCompliant(type.id)).length;

  const reqWork = organization?.required_work_references_count ?? 0;
  const reqChar = organization?.required_character_references_count ?? 0;
  const workSaved = workReferences.filter((r) => r.id).length;
  const charSaved = characterReferences.filter((r) => r.id).length;
  const workComplete = reqWork > 0 && workSaved >= reqWork;
  const charComplete = reqChar > 0 && charSaved >= reqChar;

  const totalRequired = requiredTypes.length + (reqWork > 0 ? 1 : 0) + (reqChar > 0 ? 1 : 0);
  const completedCount = uploadedRequiredCount + (workComplete ? 1 : 0) + (charComplete ? 1 : 0);
  const progress = totalRequired > 0 ? Math.round((completedCount / totalRequired) * 100) : 100;
  const hasAllRequiredDocuments = progress === 100;

  const selectedDocumentType = selectedType ? getDocTypeById(selectedType) : null;
  const selectedTypeHasExistingDoc = selectedType ? getDocsForType(selectedType).length > 0 : false;

  const documentOptions = documentTypes.map((type) => {
    const latest = getEffectiveDocStatus(type.id);
    const suffix =
      latest?.status === 'rejected'
        ? ' (re-upload)'
        : getDocsForType(type.id).length > 0
          ? ' (replace)'
          : '';
    return { ...type, label: `${type.name}${type.is_required ? ' *' : ''}${suffix}` };
  });

  const handleUpload = async () => {
    const result = onboardingDocumentSchema.safeParse({
      documentTypeId: selectedType,
      expiryDate: expiryDate || undefined,
    });
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((err) => { if (err.path[0]) errors[err.path[0] as string] = err.message; });
      setValidationErrors(errors);
      return;
    }
    if (!file) { toast.error('Please select a file to upload'); return; }
    setIsUploading(true);
    setValidationErrors({});
    try {
      const formData = new FormData();
      formData.append('token', token);
      formData.append('file', file);
      formData.append('documentTypeId', selectedType);
      if (expiryDate) formData.append('expiryDate', expiryDate);

      const response = await fetch('/api/onboarding/upload', { method: 'POST', body: formData });
      const uploadPayload = (await response.json()) as {
        document?: UploadedDoc;
        progress?: number;
        error?: string;
      };
      if (!response.ok || !uploadPayload.document) throw new Error(uploadPayload.error || 'Upload failed');

      setUploadedDocs((prev) => [uploadPayload.document!, ...prev]);
      setCarer((prev) => prev ? { ...prev, onboarding_progress: uploadPayload.progress ?? progress } : prev);
      toast.success('Document uploaded successfully');
      setFile(null);
      setSelectedType('');
      setExpiryDate('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  const updateRef = (type: 'work' | 'character', index: number, field: keyof ReferenceRow, value: string) => {
    const setter = type === 'work' ? setWorkReferences : setCharacterReferences;
    setter((current) => current.map((ref, i) => (i === index ? { ...ref, [field]: value } : ref)));
  };

  const saveReferences = async (type: 'work' | 'character', refs: ReferenceRow[]) => {
    const setIsSaving = type === 'work' ? setIsSavingWorkRefs : setIsSavingCharRefs;
    setIsSaving(true);
    try {
      const response = await fetch('/api/onboarding/references', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          carerPhone,
          references: refs.map(({ fullName, organization: org, email, phone, relationship, notes, referenceType }) => ({
            fullName, organization: org, email, phone, relationship, notes, referenceType,
          })),
        }),
      });
      const refPayload = (await response.json()) as {
        references?: ApiReference[];
        carerPhone?: string | null;
        error?: string;
      };
      if (!response.ok || !refPayload.references) throw new Error(refPayload.error || 'References could not be saved');

      const saved = refPayload.references.filter((r) => r.reference_type === type);
      const setter = type === 'work' ? setWorkReferences : setCharacterReferences;
      const req = type === 'work' ? reqWork : reqChar;
      setter(Array.from({ length: req }, (_, i) => saved[i] ? mapApiRef(saved[i], type) : emptyReference(type)));
      setCarer((prev) => (prev ? { ...prev, phone: refPayload.carerPhone ?? null } : prev));
      toast.success(type === 'work' ? 'Work references saved' : 'Character references saved');
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'References could not be saved');
    } finally {
      setIsSaving(false);
    }
  };

  const updateProfileField = (field: keyof PersonDetailsInput, value: string) => {
    setProfileForm((current) => ({ ...current, [field]: value }));
    if (field === 'phone') setCarerPhone(value);
  };

  const saveProfile = async () => {
    setIsSavingProfile(true);
    try {
      const response = await fetch('/api/onboarding/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...profileForm }),
      });
      const payload = (await response.json()) as { carer?: Partial<Carer>; error?: string };
      if (!response.ok || !payload.carer) throw new Error(payload.error || 'Profile details could not be saved.');
      setCarer((current) => (current ? { ...current, ...payload.carer } : current));
      setCarerPhone(payload.carer.phone ?? '');
      toast.success('Profile details saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Profile details could not be saved.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-page flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-page flex items-center justify-center p-6">
        <div className="rounded-2xl border border-line bg-white p-8 shadow-card max-w-md w-full text-center">
          <div className="h-12 w-12 rounded-xl bg-red-50 text-red-600 grid place-items-center mx-auto mb-5">
            <AlertCircle size={22} style={{ width: 22, height: 22 }} />
          </div>
          <h2 className="text-[20px] font-semibold text-ink mb-2">Link not valid</h2>
          <p className="text-[14px] text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-page">
      {/* Header */}
      <header className="border-b border-line bg-white sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo />
          {organization?.name && (
            <span className="text-[13px] text-slate-500">{organization.name} · onboarding portal</span>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        {/* Welcome + details card */}
        <section className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
          <div>
            <h1 className="text-[28px] font-semibold tracking-ultratight text-ink mb-2">
              Welcome, {carer?.full_name}.
            </h1>
            <p className="text-[15px] text-slate-600">
              Upload your required compliance documents and keep your reference details up to date while this onboarding link is active.
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-6">
            <div className="text-[13px] font-semibold text-ink mb-4">Your details</div>
            <div className="space-y-3 text-[13.5px] mb-5">
              <div>
                <div className="text-[12px] text-slate-500 mb-0.5">Name</div>
                <div className="font-medium text-ink">{carer?.full_name}</div>
              </div>
              <div>
                <div className="text-[12px] text-slate-500 mb-0.5">Email</div>
                <div className="font-medium text-ink">{carer?.email}</div>
              </div>
            </div>
            <PersonDetailsForm form={profileForm} onChange={updateProfileField} />
            <button
              type="button"
              disabled={isSavingProfile}
              onClick={saveProfile}
              className="mt-4 w-full h-10 rounded-lg bg-brand text-white text-[13.5px] font-medium hover:bg-brand-700 transition disabled:opacity-60">
              {isSavingProfile ? 'Saving…' : 'Save details'}
            </button>
          </div>
        </section>

        {/* All done banner */}
        {hasAllRequiredDocuments && (
          <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" style={{ width: 18, height: 18 }} />
            <div>
              <p className="text-[14px] font-semibold text-emerald-800">All requirements completed</p>
              <p className="text-[13px] text-emerald-700 mt-0.5">You can still upload replacements or update details until this link expires.</p>
            </div>
          </div>
        )}

        {/* Rejected docs banner */}
        {rejectedDocs.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5">
            <div className="flex gap-3">
              <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" style={{ width: 18, height: 18 }} />
              <div className="space-y-3">
                <div>
                  <p className="text-[14px] font-semibold text-red-800">Action required</p>
                  <p className="text-[13px] text-red-700">Some documents were rejected and need to be re-uploaded.</p>
                </div>
                {rejectedDocs.map((doc) => {
                  const docType = getDocTypeById(doc.document_type_id);
                  return (
                    <div key={doc.id} className="bg-white rounded-lg p-3 border border-red-200">
                      <p className="text-[13px] font-medium text-red-800">{docType?.name ?? 'Document'}</p>
                      <p className="text-[12.5px] text-red-700 mt-0.5">{doc.rejection_reason || 'Please upload a new copy.'}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Progress bar */}
        <div className="rounded-xl border border-line bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13.5px] font-medium text-ink">Your progress</span>
            <span className="text-[13px] text-slate-500">
              {completedCount} of {totalRequired} required {totalRequired > requiredTypes.length ? 'items' : 'documents'}
            </span>
          </div>
          <div className="h-2 bg-surface-muted rounded-full overflow-hidden">
            <div className="h-full bg-brand rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Documents grid */}
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Left: requirement list */}
          <div className="lg:col-span-2 space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-4">Required items</div>
            {documentTypes.map((docType) => {
              const isUploaded = isDocTypeCompliant(docType.id);
              const docStatus = getEffectiveDocStatus(docType.id);
              const isRejected = docStatus?.status === 'rejected';
              return (
                <div key={docType.id} className={cn(
                  'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                  isRejected ? 'bg-red-50 border-red-200' :
                  isUploaded ? 'bg-emerald-50 border-emerald-200' :
                  isDocTypeSubmitted(docType.id) ? 'bg-amber-50 border-amber-200' :
                  'bg-white border-line hover:border-line-strong',
                )}>
                  {isRejected ? <AlertCircle size={16} className="text-red-600 shrink-0" style={{ width: 16, height: 16 }} /> :
                   isUploaded ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0" style={{ width: 16, height: 16 }} /> :
                   isDocTypeSubmitted(docType.id) ? <Clock size={16} className="text-amber-500 shrink-0" style={{ width: 16, height: 16 }} /> :
                   <div className="h-4 w-4 rounded-full border-2 border-line-strong shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-ink truncate">
                      {docType.name}{docType.is_required && <span className="text-red-600 ml-1">*</span>}
                    </p>
                    <p className="text-[11.5px] text-slate-500 mt-0.5">
                      {isRejected ? 'Needs re-upload' :
                       docStatus?.status === 'pending' ? `Under review – ${new Date(docStatus.uploaded_at).toLocaleDateString()}` :
                       docStatus?.status === 'approved' ? `Approved – ${new Date(docStatus.uploaded_at).toLocaleDateString()}` :
                       docStatus ? `${docStatus.status} – ${new Date(docStatus.uploaded_at).toLocaleDateString()}` :
                       docType.expiry_months ? `Expires every ${docType.expiry_months} months` :
                       'Not submitted'}
                    </p>
                  </div>
                </div>
              );
            })}

            {reqWork > 0 && (
              <div className={cn(
                'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                workComplete ? 'bg-emerald-50 border-emerald-200' :
                workSaved > 0 ? 'bg-amber-50 border-amber-200' :
                'bg-white border-line hover:border-line-strong',
              )}>
                {workComplete ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0" style={{ width: 16, height: 16 }} /> :
                 workSaved > 0 ? <Clock size={16} className="text-amber-500 shrink-0" style={{ width: 16, height: 16 }} /> :
                 <div className="h-4 w-4 rounded-full border-2 border-line-strong shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-ink">Work References<span className="text-red-600 ml-1">*</span></p>
                  <p className="text-[11.5px] text-slate-500 mt-0.5">
                    {workComplete ? `${workSaved} of ${reqWork} saved` :
                     workSaved > 0 ? `${workSaved} of ${reqWork} saved – add more below` :
                     `${reqWork} required – complete the form below`}
                  </p>
                </div>
              </div>
            )}

            {reqChar > 0 && (
              <div className={cn(
                'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                charComplete ? 'bg-emerald-50 border-emerald-200' :
                charSaved > 0 ? 'bg-amber-50 border-amber-200' :
                'bg-white border-line hover:border-line-strong',
              )}>
                {charComplete ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0" style={{ width: 16, height: 16 }} /> :
                 charSaved > 0 ? <Clock size={16} className="text-amber-500 shrink-0" style={{ width: 16, height: 16 }} /> :
                 <div className="h-4 w-4 rounded-full border-2 border-line-strong shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-ink">Character References<span className="text-red-600 ml-1">*</span></p>
                  <p className="text-[11.5px] text-slate-500 mt-0.5">
                    {charComplete ? `${charSaved} of ${reqChar} saved` :
                     charSaved > 0 ? `${charSaved} of ${reqChar} saved – add more below` :
                     `${reqChar} required – complete the form below`}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right: upload form */}
          <div className="lg:col-span-3 rounded-2xl border border-line bg-white p-6">
            <div className="text-[16px] font-semibold text-ink mb-1">Upload document</div>
            <div className="text-[13.5px] text-slate-500 mb-6">Select a document type and upload a file for review.</div>
            <div className="space-y-5">
              <div>
                <label className="block text-[13px] font-medium text-ink mb-2">
                  Document type <span className="text-red-600">*</span>
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => {
                    setSelectedType(e.target.value);
                    setValidationErrors((prev) => { const next = { ...prev }; delete next.documentTypeId; return next; });
                  }}
                  className={cn(
                    'w-full h-10 rounded-lg border bg-white px-3 text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition',
                    validationErrors.documentTypeId ? 'border-red-400' : 'border-line-strong',
                  )}>
                  <option value="">Select document type…</option>
                  {documentOptions.map((type) => (
                    <option key={type.id} value={type.id}>{type.label}</option>
                  ))}
                </select>
                {validationErrors.documentTypeId && (
                  <p className="text-[12px] text-red-600 mt-1">{validationErrors.documentTypeId}</p>
                )}
              </div>

              <div>
                <label className="block text-[13px] font-medium text-ink mb-2">Expiry date</label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  disabled={!selectedDocumentType}
                  className={cn(inputCls, 'disabled:opacity-50')}
                />
                <p className="text-[12px] text-slate-500 mt-1">
                  {!selectedDocumentType
                    ? 'Select a document type first, then add an expiry date if one applies.'
                    : selectedDocumentType.expiry_months
                      ? 'Enter the expiry date shown on your document.'
                      : 'Leave blank if the document has no expiry date.'}
                </p>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-ink mb-2">File <span className="text-red-600">*</span></label>
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                  onDrop={(e) => { e.preventDefault(); setIsDragging(false); setFile(e.dataTransfer.files[0] ?? null); }}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
                    isDragging ? 'border-brand bg-brand-50' : 'border-line hover:border-brand/50',
                    file && 'border-solid border-line-strong bg-surface-page',
                  )}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  />
                  {file ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText size={36} className="text-slate-400 shrink-0" style={{ width: 36, height: 36 }} />
                      <div className="text-left min-w-0">
                        <p className="text-[13.5px] font-medium text-ink truncate max-w-[220px]">{file.name}</p>
                        <p className="text-[12px] text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                        className="ml-2 h-8 w-8 grid place-items-center rounded-md text-slate-400 hover:text-ink hover:bg-surface-page transition">
                        <X size={14} style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload size={32} className="text-slate-300 mx-auto mb-3" style={{ width: 32, height: 32 }} />
                      <p className="text-[13.5px] font-medium text-ink">Drop your file here or click to browse</p>
                      <p className="text-[12px] text-slate-500 mt-1">PDF, JPG, PNG, DOC, DOCX up to 10 MB</p>
                    </>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleUpload}
                disabled={!file || !selectedType || isUploading}
                className="w-full h-11 rounded-lg bg-brand text-white font-medium text-[14px] inline-flex items-center justify-center gap-2 hover:bg-brand-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
                {isUploading ? (
                  <><Loader2 size={15} className="animate-spin" style={{ width: 15, height: 15 }} /> Uploading…</>
                ) : (
                  <><Upload size={15} style={{ width: 15, height: 15 }} /> {selectedTypeHasExistingDoc ? 'Upload replacement' : 'Upload document'}</>
                )}
              </button>
            </div>
          </div>
        </div>

        {reqWork > 0 && (
          <ReferenceCard
            title="Work references"
            description={`Provide ${reqWork} work reference${reqWork > 1 ? 's' : ''} from previous employers or colleagues.`}
            references={workReferences}
            isSaving={isSavingWorkRefs}
            onUpdate={(index, field, value) => updateRef('work', index, field, value)}
            onSave={() => saveReferences('work', workReferences)}
          />
        )}

        {reqChar > 0 && (
          <ReferenceCard
            title="Character references"
            description={`Provide ${reqChar} character reference${reqChar > 1 ? 's' : ''} from someone who can vouch for your character.`}
            references={characterReferences}
            isSaving={isSavingCharRefs}
            onUpdate={(index, field, value) => updateRef('character', index, field, value)}
            onSave={() => saveReferences('character', characterReferences)}
          />
        )}
      </main>
    </div>
  );
}

type ReferenceCardProps = {
  title: string;
  description: string;
  references: ReferenceRow[];
  isSaving: boolean;
  onUpdate: (index: number, field: keyof ReferenceRow, value: string) => void;
  onSave: () => void;
};

function ReferenceCard({ title, description, references, isSaving, onUpdate, onSave }: ReferenceCardProps) {
  return (
    <div className="rounded-2xl border border-line bg-white p-6">
      <div className="text-[16px] font-semibold text-ink mb-1">{title}</div>
      <div className="text-[13.5px] text-slate-500 mb-6">{description}</div>
      <div className="space-y-6">
        {references.map((reference, index) => (
          <div key={reference.id ?? index} className="rounded-xl border border-line p-5 space-y-4">
            <div className="text-[13px] font-semibold text-ink">Reference {index + 1}</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-[12.5px] font-medium text-ink mb-1.5 block">Name <span className="text-red-600">*</span></span>
                <input value={reference.fullName} onChange={(e) => onUpdate(index, 'fullName', e.target.value)} className={inputCls} />
              </label>
              <label className="block">
                <span className="text-[12.5px] font-medium text-ink mb-1.5 block">Organisation</span>
                <input value={reference.organization} placeholder="e.g. ABC Care Home" onChange={(e) => onUpdate(index, 'organization', e.target.value)} className={inputCls} />
              </label>
              <label className="block">
                <span className="text-[12.5px] font-medium text-ink mb-1.5 block">Relationship <span className="text-red-600">*</span></span>
                <input value={reference.relationship} onChange={(e) => onUpdate(index, 'relationship', e.target.value)} className={inputCls} />
              </label>
              <label className="block">
                <span className="text-[12.5px] font-medium text-ink mb-1.5 block">Email <span className="text-red-600">*</span></span>
                <input type="email" value={reference.email} onChange={(e) => onUpdate(index, 'email', e.target.value)} className={inputCls} />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[12.5px] font-medium text-ink mb-1.5 block">Phone <span className="text-red-600">*</span></span>
                <input type="tel" value={reference.phone} onChange={(e) => onUpdate(index, 'phone', e.target.value)} className={inputCls} />
              </label>
            </div>
            <label className="block">
              <span className="text-[12.5px] font-medium text-ink mb-1.5 block">Notes</span>
              <textarea value={reference.notes} rows={2} onChange={(e) => onUpdate(index, 'notes', e.target.value)} className={textareaCls} />
            </label>
          </div>
        ))}
        <div className="flex justify-end">
          <button
            type="button"
            disabled={isSaving}
            onClick={onSave}
            className="h-10 px-5 rounded-lg bg-brand text-white text-[13.5px] font-medium hover:bg-brand-700 transition disabled:opacity-60">
            {isSaving ? 'Saving…' : `Save ${title}`}
          </button>
        </div>
      </div>
    </div>
  );
}
