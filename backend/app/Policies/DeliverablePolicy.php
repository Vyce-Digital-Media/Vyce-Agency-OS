<?php

namespace App\Policies;

use App\Models\Deliverable;
use App\Models\User;

class DeliverablePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isInternal() || $user->hasRole('client');
    }

    public function view(User $user, Deliverable $deliverable): bool
    {
        return $user->isInternal() || $deliverable->plan?->client?->user_id === $user->id;
    }

    public function create(User $user): bool
    {
        return $user->hasAnyRole(['admin', 'manager']);
    }

    public function update(User $user, Deliverable $deliverable): bool
    {
        return $user->hasAnyRole(['admin', 'manager'])
            || $deliverable->assigned_to === $user->id;
    }

    public function delete(User $user, Deliverable $deliverable): bool
    {
        return $user->hasRole('admin');
    }

    public function approve(User $user, Deliverable $deliverable): bool
    {
        return $user->hasAnyRole(['admin', 'manager'])
            || $deliverable->plan?->client?->user_id === $user->id;
    }
}
