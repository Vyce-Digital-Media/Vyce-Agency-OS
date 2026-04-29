<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TimeEntry;
use Carbon\Carbon;
use Illuminate\Http\Request;

class AttendanceController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('viewAny', TimeEntry::class);

        $query = TimeEntry::query()->latest('clock_in');
        if (! $request->user()->hasAnyRole(['admin', 'manager'])) {
            $query->where('user_id', $request->user()->id);
        }

        if ($request->filled('from')) {
            $query->whereDate('date', '>=', $request->date('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('date', '<=', $request->date('to'));
        }

        return response()->json(['data' => $query->get()]);
    }

    public function clockIn(Request $request)
    {
        $this->authorize('create', TimeEntry::class);

        return response()->json(['data' => $this->openEntry($request, false)], 201);
    }

    public function breakStart(Request $request)
    {
        $this->authorize('create', TimeEntry::class);

        return response()->json(['data' => $this->openEntry($request, true)], 201);
    }

    public function clockOut(Request $request)
    {
        return $this->closeLatestOpenEntry($request, false);
    }

    public function breakEnd(Request $request)
    {
        return $this->closeLatestOpenEntry($request, true);
    }

    public function update(Request $request, TimeEntry $timeEntry)
    {
        $this->authorize('update', $timeEntry);

        $data = $request->validate([
            'clock_in' => ['sometimes', 'date'],
            'clock_out' => ['sometimes', 'nullable', 'date'],
            'date' => ['sometimes', 'date'],
            'notes' => ['sometimes', 'nullable', 'string'],
            'is_break' => ['sometimes', 'boolean'],
        ]);

        if (isset($data['clock_in'], $data['clock_out']) && $data['clock_out']) {
            $data['duration_minutes'] = Carbon::parse($data['clock_in'])->diffInMinutes(Carbon::parse($data['clock_out']));
        }

        $timeEntry->update($data);

        return response()->json(['data' => $timeEntry->fresh()]);
    }

    private function openEntry(Request $request, bool $isBreak): TimeEntry
    {
        return TimeEntry::create([
            'user_id' => $request->user()->id,
            'date' => now()->toDateString(),
            'clock_in' => now(),
            'is_break' => $isBreak,
        ]);
    }

    private function closeLatestOpenEntry(Request $request, bool $isBreak)
    {
        $entry = TimeEntry::query()
            ->where('user_id', $request->user()->id)
            ->where('is_break', $isBreak)
            ->whereNull('clock_out')
            ->latest('clock_in')
            ->firstOrFail();

        $this->authorize('update', $entry);

        $entry->update([
            'clock_out' => now(),
            'duration_minutes' => $entry->clock_in->diffInMinutes(now()),
        ]);

        return response()->json(['data' => $entry->fresh()]);
    }
}
