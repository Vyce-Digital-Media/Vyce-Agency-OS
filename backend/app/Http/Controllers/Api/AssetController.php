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
    public function store(Request $request, string $bucket, string $path)
    {
        abort_unless($request->user()->hasAnyRole(['admin', 'manager', 'team_member']), 403);

        $request->validate([
            'file' => ['required', 'file', 'max:20480'],
        ]);

        $file = $request->file('file');
        
        // Use the public disk so assets are accessible via the /storage symlink
        $fullPath = $file->storeAs($bucket, $path, 'public');

        if (!$fullPath) {
            return response()->json(['error' => 'Failed to save file to storage'], 500);
        }

        return response()->json([
            'data' => [
                'path' => $path,
                'fullPath' => $fullPath
            ]
        ], 201);
    }

    // ── GET /deliverable_assets?deliverable_id=xxx ──────────────────────
    public function indexDeliverableAssets(Request $request)
    {
        $query = DeliverableAsset::query()->latest('created_at');
        if ($request->filled('deliverable_id')) {
            $query->where('deliverable_id', $request->deliverable_id);
        }
        return response()->json(['data' => $query->get()]);
    }

    // ── DELETE /deliverable_assets?id=xxx ────────────────────────────────
    public function destroyDeliverableAsset(Request $request)
    {
        $asset = DeliverableAsset::findOrFail($request->query('id'));
        $allowed = $request->user()->hasRole('admin') || $asset->uploaded_by === $request->user()->id;
        abort_unless($allowed, 403);
        Storage::disk('public')->delete($asset->file_url);
        $asset->delete();
        return response()->json(['success' => true]);
    }

    // ── POST /deliverable_assets ─────────────────────────────────────────
    public function storeDeliverableAsset(Request $request)
    {
        $data = $request->validate([
            'deliverable_id' => ['required', 'exists:deliverables,id'],
            'file_name' => ['required', 'string'],
            'file_url' => ['required', 'string'],
            'file_type' => ['nullable', 'string'],
            'file_size' => ['nullable', 'integer'],
            'uploaded_by' => ['required', 'exists:users,id'],
        ]);

        $asset = DeliverableAsset::create($data);
        return response()->json(['data' => $asset], 201);
    }

    // ── GET /client_assets?client_id=xxx ────────────────────────────────
    public function indexClientAssets(Request $request)
    {
        $query = ClientAsset::query()->latest('created_at');
        if ($request->filled('client_id')) {
            $query->where('client_id', $request->client_id);
        }
        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }
        return response()->json(['data' => $query->get()]);
    }

    // ── DELETE /client_assets?id=xxx ─────────────────────────────────────
    public function destroyClientAsset(Request $request)
    {
        $asset = ClientAsset::findOrFail($request->query('id'));
        $allowed = $request->user()->hasRole('admin') || $asset->uploaded_by === $request->user()->id;
        abort_unless($allowed, 403);
        Storage::disk('public')->delete($asset->file_url);
        $asset->delete();
        return response()->json(['success' => true]);
    }

    // ── POST /client_assets ──────────────────────────────────────────────
    public function storeClientAsset(Request $request)
    {
        $data = $request->validate([
            'client_id' => ['required', 'exists:clients,id'],
            'file_name' => ['required', 'string'],
            'file_url' => ['required', 'string'],
            'file_type' => ['nullable', 'string'],
            'file_size' => ['nullable', 'integer'],
            'uploaded_by' => ['required', 'exists:users,id'],
            'category' => ['sometimes', 'string'],
            'notes' => ['sometimes', 'nullable', 'string'],
        ]);

        $asset = ClientAsset::create([
            'client_id' => $data['client_id'],
            'file_name' => $data['file_name'],
            'file_url' => $data['file_url'],
            'file_type' => $data['file_type'],
            'file_size' => $data['file_size'],
            'uploaded_by' => $data['uploaded_by'],
            'category' => $data['category'] ?? 'other',
            'notes' => $data['notes'] ?? null,
        ]);

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

        abort_unless(Storage::disk('public')->exists($model->file_url), 404);

        return Storage::disk('public')->download($model->file_url, $model->file_name);
    }

    public function destroy(Request $request, string $bucket, string $asset)
    {
        $model = $bucket === 'client-assets'
            ? ClientAsset::findOrFail($asset)
            : DeliverableAsset::findOrFail($asset);

        $allowed = $request->user()->hasRole('admin') || $model->uploaded_by === $request->user()->id;
        abort_unless($allowed, 403);

        Storage::disk('public')->delete($model->file_url);
        $model->delete();

        return response()->json(['success' => true]);
    }
}
