import React, { useEffect, useState } from 'react';
import apiClient, { getFileUrl } from '../../services/api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { useAuth } from '../../hooks/useAuth';

const AdminProfile: React.FC = () => {
  const { user } = useAuth();
  const [details, setDetails] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedQr, setSelectedQr] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);

  const load = async () => {
    if (!user?.user_id) return;
    setLoading(true);
    try {
      const res = await apiClient.get(`/users/${user.user_id}/admin-profile`);
      setDetails(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onChooseQr = (file?: File) => {
    if (!file) return;
    setSelectedQr(file);
    if (qrPreview) URL.revokeObjectURL(qrPreview);
    setQrPreview(URL.createObjectURL(file));
  };

  const onSave = async () => {
    if (!user?.user_id || !selectedQr) return;
    const form = new FormData();
    form.append('file', selectedQr);
    try {
      setSaving(true);
      await apiClient.post(`/users/${user.user_id}/admin-qr`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await load();
      setSelectedQr(null);
      if (qrPreview) {
        URL.revokeObjectURL(qrPreview);
        setQrPreview(null);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading profile…</div>;
  }

  if (!details) {
    return <div className="p-6">Profile not found.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Admin Profile</h1>

      <Card className="p-4">
        <div className="flex items-center gap-4">
          <img
            src={getFileUrl(details.profile_image_url || '')}
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(details.name || 'Admin')}&background=random`;
            }}
            alt={details.name}
            className="h-16 w-16 rounded-full object-cover border"
            style={{ aspectRatio: '1 / 1' }}
          />
          <div>
            <div className="text-slate-800 font-semibold">{details.name}</div>
            <div className="text-slate-600 text-sm">{details.email}</div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-4">
          <div className="text-slate-500 text-sm">University</div>
          <div className="text-slate-800">{details.university_name || 'N/A'}</div>
        </Card>
        <Card className="p-4">
          <div className="text-slate-500 text-sm">Joined</div>
          <div className="text-slate-800">
            {details.created_at ? new Date(details.created_at).toLocaleDateString() : 'N/A'}
          </div>
        </Card>
      </div>

      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Admin QR Code</h2>
          {(details.qr_code_url || qrPreview) && (
            <a
              href={getFileUrl(details.qr_code_url || '')}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary-600 hover:underline"
            >
              View full
            </a>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="w-28 h-28 bg-white border rounded flex items-center justify-center overflow-hidden">
            {qrPreview || details.qr_code_url ? (
              <img
                src={qrPreview || getFileUrl(details.qr_code_url || '')}
                alt="Admin QR"
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="text-slate-400 text-sm">No QR uploaded</span>
            )}
          </div>
          <div className="space-y-2">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onChooseQr(e.target.files?.[0] || undefined)}
              disabled={saving}
            />
            {selectedQr && (
              <div>
                <Button onClick={onSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AdminProfile;

