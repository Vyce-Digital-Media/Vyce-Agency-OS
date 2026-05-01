<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Deliverable;
use App\Models\DeliverableComment;
use Illuminate\Http\Request;

class CommentController extends Controller
{
    public function index(Deliverable $deliverable)
    {
        return response()->json(['data' => $deliverable->comments()->with('user.profile')->get()]);
    }

    public function store(Request $request, Deliverable $deliverable)
    {
        $data = $request->validate([
            'body' => 'required|string',
        ]);

        $comment = $deliverable->comments()->create([
            'user_id' => $request->user()->id,
            'body' => $data['body'],
        ]);

        return response()->json(['data' => $comment->load('user.profile')]);
    }

    public function destroy(DeliverableComment $comment)
    {
        if ($comment->user_id !== auth()->id() && !auth()->user()->hasAnyRole(['admin', 'manager'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $comment->delete();
        return response()->json(['success' => true]);
    }
}
