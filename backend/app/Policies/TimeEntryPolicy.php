<?php

namespace App\Policies;

use App\Models\TimeEntry;
use App\Models\User;

class TimeEntryPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasAnyRole(['admin', 'manager', 'team_member']);
    }

    public function view(User $user, TimeEntry $timeEntry): bool
    {
        return $timeEntry->user_id === $user->id || $user->hasAnyRole(['admin', 'manager']);
    }

    public function create(User $user): bool
    {
        return $user->hasAnyRole(['admin', 'manager', 'team_member']);
    }

    public function update(User $user, TimeEntry $timeEntry): bool
    {
        return $timeEntry->user_id === $user->id || $user->hasAnyRole(['admin', 'manager']);
    }

    public function delete(User $user, TimeEntry $timeEntry): bool
    {
        return $user->hasRole('admin');
    }
}
