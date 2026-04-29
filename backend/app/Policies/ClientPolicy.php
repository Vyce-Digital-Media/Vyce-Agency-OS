<?php

namespace App\Policies;

use App\Models\Client;
use App\Models\User;

class ClientPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isInternal() || $user->hasRole('client');
    }

    public function view(User $user, Client $client): bool
    {
        return $user->isInternal() || $client->user_id === $user->id;
    }

    public function create(User $user): bool
    {
        return $user->hasAnyRole(['admin', 'manager']);
    }

    public function update(User $user, Client $client): bool
    {
        return $user->hasAnyRole(['admin', 'manager']);
    }

    public function delete(User $user, Client $client): bool
    {
        return $user->hasRole('admin');
    }
}
