<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Deliverable;
use App\Models\Profile;
use App\Models\User;
use App\Models\UserRole;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

class TeamController extends Controller
{
    public function index(Request $request)
    {
        $isSelf = $request->filled('user_id') && $request->user_id === $request->user()->id;
        abort_unless($isSelf || $request->user()->hasAnyRole(['admin', 'manager']), 403);

        $activeDeliverableStats = Deliverable::query()
            ->selectRaw('assigned_to, count(*) as total, sum(estimated_minutes) as total_minutes')
            ->whereNotNull('assigned_to')
            ->whereNotIn('status', ['approved', 'delivered'])
            ->groupBy('assigned_to')
            ->get()
            ->keyBy('assigned_to');

        $users = User::query()
            ->with(['profile', 'roles'])
            ->whereHas('roles', fn ($query) => $query->whereIn('role', ['admin', 'manager', 'team_member', 'client']))
            ->when(! $request->user()->hasAnyRole(['admin', 'manager']), fn ($q) => $q->where('id', $request->user()->id))
            ->get()
            ->map(fn (User $user) => [
                'user_id' => $user->id,
                'email' => $user->email,
                'full_name' => $user->profile?->full_name ?? '',
                'avatar_url' => $user->profile?->avatar_url,
                'internal_label' => $user->profile?->internal_label,
                'expected_start_time' => $user->profile?->expected_start_time,
                'salary_hourly' => $request->user()->hasRole('admin') ? $user->profile?->salary_hourly : null,
                'role' => $user->primaryRole(),
                'deliverableCount' => (int) ($activeDeliverableStats[$user->id]->total ?? 0),
                'totalEstimatedMinutes' => (int) ($activeDeliverableStats[$user->id]->total_minutes ?? 0),
            ]);

        return response()->json(['data' => $users]);
    }

    public function invite(Request $request)
    {
        abort_unless($request->user()->hasRole('admin'), 403);

        $data = $request->validate([
            'email' => ['required', 'email'],
            'full_name' => ['required', 'string', 'max:255'],
            'role' => ['required', 'in:admin,manager,team_member,client'],
        ]);

        $user = User::firstOrCreate(
            ['email' => $data['email']],
            ['password' => Hash::make(Str::random(48))]
        );

        Profile::updateOrCreate(
            ['user_id' => $user->id],
            ['full_name' => $data['full_name']]
        );

        UserRole::updateOrCreate(
            ['user_id' => $user->id],
            ['role' => $data['role']]
        );

        Password::sendResetLink(['email' => $user->email]);

        return response()->json([
            'success' => true,
            'user_id' => $user->id,
            'email' => $user->email,
        ]);
    }

    public function remove(Request $request, User $user)
    {
        abort_unless($request->user()->hasRole('admin'), 403);
        abort_if($request->user()->id === $user->id, 422, 'Cannot remove yourself');

        $user->delete();

        return response()->json(['success' => true]);
    }

    public function updateRole(Request $request, User $user)
    {
        abort_unless($request->user()->hasRole('admin'), 403);

        $data = $request->validate([
            'role' => ['required', 'in:admin,manager,team_member,client'],
        ]);

        UserRole::updateOrCreate(['user_id' => $user->id], ['role' => $data['role']]);

        return response()->json(['success' => true]);
    }

    public function updateProfile(Request $request, User $user)
    {
        abort_unless($request->user()->hasAnyRole(['admin', 'manager']) || $request->user()->id === $user->id, 403);

        $rules = [
            'full_name' => ['sometimes', 'string', 'max:255'],
            'internal_label' => ['sometimes', 'nullable', 'string', 'max:255'],
            'expected_start_time' => ['sometimes', 'nullable', 'date_format:H:i'],
        ];

        if ($request->user()->hasRole('admin')) {
            $rules['salary_hourly'] = ['sometimes', 'nullable', 'numeric', 'min:0'];
        }

        $data = $request->validate($rules);

        Profile::updateOrCreate(['user_id' => $user->id], $data);

        return response()->json(['success' => true]);
    }

    public function salaries(Request $request)
    {
        abort_unless($request->user()->hasRole('admin'), 403);

        return response()->json([
            'salaries' => Profile::query()->select('user_id', 'salary_hourly')->get(),
        ]);
    }
}
