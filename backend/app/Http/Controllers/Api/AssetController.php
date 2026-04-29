<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\ClientAsset;
use App\Models\Deliverable;
use App\Models\DeliverableAsset;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

class AssetController extends Controller
{
    public function store(Request $request, string $bucket, string $folder)
    {
        abort_unless($request->user()->hasAnyRole(['admin', 'manager', 'team_member']), 403);

        $data = $request->validate([
            'file' => ['required', 'file', 'max:20480'],
            'category' => ['sometimes', 'string', 'max:100'],
            'asset_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'content_type' => ['sometimes', 'string', 'max:100'],
            'notes' => ['sometimes', 'nullable', 'string'],
            'section' => ['sometimes', 'string', 'max:100'],
        ]);

        $file = $data['file'];
        $path = $file->storeAs(
            "private/{$bucket}/{$folder}",
            now()->timestamp . '_' . preg_replace('/[^A-Za-z0-9._-]/', '_', $file->getClientOriginalName())
        );

        if ($bucket === 'client-assets') {
            abort_unless(Client::whereKey($folder)->exists(), 404);

            $asset = ClientAsset::create([
                'client_id' => $folder,
                'file_name' => $file->getClientOriginalName(),
                'file_url' => $path,
                'file_type' => $file->getMimeType(),
                'file_size' => $file->getSize(),
                'uploaded_by' => $request->user()->id,
                'category' => $data['category'] ?? 'other',
                'asset_name' => $data['asset_name'] ?? null,
                'content_type' => $data['content_type'] ?? 'file',
                'notes' => $data['notes'] ?? null,
                'section' => $data['section'] ?? 'general',
            ]);
        } else {
            abort_unless(Deliverable::whereKey($folder)->exists(), 404);

            $asset = DeliverableAsset::create([
                'deliverable_id' => $folder,
                'file_name' => $file->getClientOriginalName(),
                'file_url' => $path,
                'file_type' => $file->getMimeType(),
                'file_size' => $file->getSize(),
                'uploaded_by' => $request->user()->id,
            ]);
        }

        return response()->json(['data' => $asset], 201);
    }

    public function signedUrl(Request $request, string $bucket, string $asset)
    {
        $model = $bucket === 'client-assets'
            ? ClientAsset::with('client')->findOrFail($asset)
            : DeliverableAsset::with('deliverable.plan.client')->findOrFail($asset);

        $allowed = $request->user()->isInternal()
            || ($bucket === 'client-assets'
                ? $model->client?->user_id === $request->user()->id
                : $model->deliverable?->plan?->client?->user_id === $request->user()->id);

        abort_unless($allowed, 403);

        return response()->json([
            'signedUrl' => URL::temporarySignedRoute('asset.download', now()->addHour(), [
                'asset' => $model->id,
                'bucket' => $bucket,
            ]),
        ]);
    }

    public function download(string $bucket, string $asset)
    {
        $model = $bucket === 'client-assets'
            ? ClientAsset::findOrFail($asset)
            : DeliverableAsset::findOrFail($asset);

        abort_unless(Storage::exists($model->file_url), 404);

        return Storage::download($model->file_url, $model->file_name);
    }

    public function destroy(Request $request, string $bucket, string $asset)
    {
        $model = $bucket === 'client-assets'
            ? ClientAsset::findOrFail($asset)
            : DeliverableAsset::findOrFail($asset);

        $allowed = $request->user()->hasRole('admin') || $model->uploaded_by === $request->user()->id;
        abort_unless($allowed, 403);

        Storage::delete($model->file_url);
        $model->delete();

        return response()->json(['success' => true]);
    }
}
