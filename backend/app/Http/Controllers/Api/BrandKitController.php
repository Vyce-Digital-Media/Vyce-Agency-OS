<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BrandKit;
use App\Models\Client;
use Illuminate\Http\Request;

class BrandKitController extends Controller
{
    public function index(Client $client)
    {
        return response()->json(['data' => $client->brandKits()->get()]);
    }

    public function store(Request $request, Client $client)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'category' => 'required|string|in:logo,color,font,asset',
            'content' => 'nullable|string',
            'file_url' => 'nullable|string',
            'link_url' => 'nullable|string',
        ]);

        $kit = $client->brandKits()->create($data);

        return response()->json(['data' => $kit]);
    }

    public function destroy(BrandKit $brandKit)
    {
        $brandKit->delete();
        return response()->json(['success' => true]);
    }
}
