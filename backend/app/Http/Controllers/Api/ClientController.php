<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use Illuminate\Http\Request;

class ClientController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('viewAny', Client::class);

        $query = Client::query()->latest();
        if ($request->user()->hasRole('client')) {
            $query->where('user_id', $request->user()->id);
        }

        return response()->json(['data' => $query->get()]);
    }

    public function store(Request $request)
    {
        $this->authorize('create', Client::class);

        $data = $this->validated($request);
        $data['created_by'] = $request->user()->id;

        return response()->json(['data' => Client::create($data)], 201);
    }

    public function show(Request $request, Client $client)
    {
        $this->authorize('view', $client);

        return response()->json(['data' => $client->load([
            'assets',
            'plans.deliverables',
            'plans.deliverables.assets',
            'plans.deliverables.assignedUser.profile',
        ])]);
    }

    public function update(Request $request, Client $client)
    {
        $this->authorize('update', $client);

        $client->update($this->validated($request, false));

        return response()->json(['data' => $client]);
    }

    public function destroy(Client $client)
    {
        $this->authorize('delete', $client);
        $client->delete();

        return response()->json(['success' => true]);
    }

    private function validated(Request $request, bool $creating = true): array
    {
        return $request->validate([
            'name' => [$creating ? 'required' : 'sometimes', 'string', 'max:255'],
            'contact_email' => ['sometimes', 'nullable', 'email'],
            'contact_phone' => ['sometimes', 'nullable', 'string', 'max:40'],
            'brand_color' => ['sometimes', 'nullable', 'string', 'max:24'],
            'secondary_color' => ['sometimes', 'nullable', 'string', 'max:24'],
            'brand_slogan' => ['sometimes', 'nullable', 'string', 'max:255'],
            'logo_url' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'notes' => ['sometimes', 'nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
            'user_id' => ['sometimes', 'nullable', 'exists:users,id'],
            'contract_type' => ['sometimes', 'nullable', 'string', 'max:255'],
            'monthly_retainer' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'one_time_cost' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'onboarded_at' => ['sometimes', 'nullable', 'date'],
        ]);
    }
}
