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

        // Apply filters from query params (REST shim)
        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        } elseif (! $request->user()->hasAnyRole(['admin', 'manager'])) {
            $query->where('user_id', $request->user()->id);
        }

        if ($request->filled('date')) {
            $query->whereDate('date', $request->date);
        }
        if ($request->filled('from')) {
            $query->whereDate('date', '>=', $request->from);
        }
        if ($request->filled('to')) {
            $query->whereDate('date', '<=', $request->to);
        }
        if ($request->filled('gte_date')) {
            $query->whereDate('date', '>=', $request->gte_date);
        }
        if ($request->filled('lte_date')) {
            $query->whereDate('date', '<=', $request->lte_date);
        }
        if ($request->has('is_break')) {
            $query->where('is_break', filter_var($request->is_break, FILTER_VALIDATE_BOOLEAN));
        }
        if ($request->has('is_clock_out') && $request->is_clock_out === 'null') {
            $query->whereNull('clock_out');
        }
        if ($request->has('not_clock_out') && $request->not_clock_out === 'null') {
            $query->whereNotNull('clock_out');
        }

        return response()->json(['data' => $query->get()]);
    }

    public function status(Request $request)
    {
        $userId = $request->user()->id;
        $today = now()->toDateString();
        // startOfWeek(Carbon::MONDAY) ensures week starts on Monday (typical business logic, matching React date-fns startOfWeek({ weekStartsOn: 1 }))
        $weekStart = now()->startOfWeek(Carbon::MONDAY)->toDateString();

        $activeWork = TimeEntry::query()
            ->where('user_id', $userId)
            ->where('is_break', false)
            ->whereNull('clock_out')
            ->latest('clock_in')
            ->first();

        $activeBreak = TimeEntry::query()
            ->where('user_id', $userId)
            ->where('is_break', true)
            ->whereNull('clock_out')
            ->latest('clock_in')
            ->first();

        $todayWork = TimeEntry::query()
            ->where('user_id', $userId)
            ->where('is_break', false)
            ->where('date', $today)
            ->whereNotNull('clock_out')
            ->sum('duration_seconds');

        $todayBreak = TimeEntry::query()
            ->where('user_id', $userId)
            ->where('is_break', true)
            ->where('date', $today)
            ->whereNotNull('clock_out')
            ->sum('duration_seconds');

        $weekWork = TimeEntry::query()
            ->where('user_id', $userId)
            ->where('is_break', false)
            ->where('date', '>=', $weekStart)
            ->whereNotNull('clock_out')
            ->sum('duration_seconds');

        $weekBreak = TimeEntry::query()
            ->where('user_id', $userId)
            ->where('is_break', true)
            ->where('date', '>=', $weekStart)
            ->whereNotNull('clock_out')
            ->sum('duration_seconds');

        return response()->json([
            'active_work' => $activeWork,
            'active_break' => $activeBreak,
            'today_stats' => [
                'gross_secs' => (int) $todayWork,
                'break_secs' => (int) $todayBreak,
            ],
            'week_stats' => [
                'gross_secs' => (int) $weekWork,
                'break_secs' => (int) $weekBreak,
            ],
        ]);
    }

    public function store(Request $request)
    {
        $this->authorize('create', TimeEntry::class);

        $data = $request->validate([
            'user_id' => ['required', 'exists:users,id'],
            'date' => ['required', 'date'],
            'clock_in' => ['required', 'date'],
            'is_break' => ['sometimes', 'boolean'],
            'notes' => ['sometimes', 'nullable', 'string'],
        ]);

        return response()->json(['data' => TimeEntry::create($data)], 201);
    }

    public function clockIn(Request $request)
    {
        $this->authorize('create', TimeEntry::class);

        $data = $request->validate([
            'notes' => ['sometimes', 'nullable', 'string'],
        ]);

        return response()->json(['data' => $this->openEntry($request, false, $data['notes'] ?? null)], 201);
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

        $clockIn = $data['clock_in'] ?? $timeEntry->clock_in;
        $clockOut = $data['clock_out'] ?? $timeEntry->clock_out;
        
        if ($clockIn && $clockOut) {
            $data['duration_seconds'] = Carbon::parse($clockIn)->diffInSeconds(Carbon::parse($clockOut));
        }

        $timeEntry->update($data);

        return response()->json(['data' => $timeEntry->fresh()]);
    }

    private function openEntry(Request $request, bool $isBreak, ?string $notes = null): TimeEntry
    {
        return TimeEntry::create([
            'user_id' => $request->user()->id,
            'date' => now()->toDateString(),
            'clock_in' => now(),
            'is_break' => $isBreak,
            'notes' => $notes,
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
            'duration_seconds' => $entry->clock_in->diffInSeconds(now()),
        ]);

        return response()->json(['data' => $entry->fresh()]);
    }
}
