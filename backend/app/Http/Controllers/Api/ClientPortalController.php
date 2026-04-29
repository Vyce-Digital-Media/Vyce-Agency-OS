<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\Deliverable;
use Illuminate\Http\Request;

class ClientPortalController extends Controller
{
    public function dashboard(Request $request)
    {
        abort_unless($request->user()->hasRole('client'), 403);

        $client = Client::query()->where('user_id', $request->user()->id)->firstOrFail();

        return response()->json([
            'client' => $client,
            'plans' => $client->plans()->with('deliverables')->latest()->get(),
        ]);
    }

    public function deliverables(Request $request)
    {
        abort_unless($request->user()->hasRole('client'), 403);

        return response()->json([
            'data' => Deliverable::query()
                ->with(['plan.client', 'assets'])
                ->whereHas('plan.client', fn ($q) => $q->where('user_id', $request->user()->id))
                ->latest('due_date')
                ->get(),
        ]);
    }
}
