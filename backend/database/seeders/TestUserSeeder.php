<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Profile;
use App\Models\UserRole;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class TestUserSeeder extends Seeder
{
    public function run()
    {
        $users = [
            [
                'email' => 'admin@example.com',
                'name' => 'Admin User',
                'role' => 'admin',
                'label' => 'Super Admin'
            ],
            [
                'email' => 'manager@example.com',
                'name' => 'Manager User',
                'role' => 'manager',
                'label' => 'Operations Manager'
            ],
            [
                'email' => 'team@example.com',
                'name' => 'Team Member',
                'role' => 'team_member',
                'label' => 'Creative Designer'
            ],
            [
                'email' => 'client@example.com',
                'name' => 'Client User',
                'role' => 'client',
                'label' => 'Vyce Partner'
            ],
        ];

        foreach ($users as $userData) {
            $user = User::updateOrCreate(
                ['email' => $userData['email']],
                [
                    'password' => Hash::make('password'),
                ]
            );

            Profile::updateOrCreate(
                ['user_id' => $user->id],
                [
                    'full_name' => $userData['name'],
                    'internal_label' => $userData['label'],
                ]
            );

            UserRole::updateOrCreate(
                ['user_id' => $user->id],
                ['role' => $userData['role']]
            );
        }
    }
}
