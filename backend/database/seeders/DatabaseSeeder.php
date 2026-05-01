<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $password = bcrypt('password');

        // 1. Admin
        $admin = User::create([
            'email' => 'admin@example.com',
            'password' => $password,
            'email_verified_at' => now(),
        ]);
        $admin->profile()->create(['full_name' => 'Admin User']);
        $admin->roles()->create(['role' => 'admin']);

        // 2. Manager
        $manager = User::create([
            'email' => 'manager@example.com',
            'password' => $password,
            'email_verified_at' => now(),
        ]);
        $manager->profile()->create(['full_name' => 'Manager User']);
        $manager->roles()->create(['role' => 'manager']);

        // 3. Team Member
        $team = User::create([
            'email' => 'team@example.com',
            'password' => $password,
            'email_verified_at' => now(),
        ]);
        $team->profile()->create(['full_name' => 'Team Member']);
        $team->roles()->create(['role' => 'team_member']);

        // 4. Client
        $client = User::create([
            'email' => 'client@example.com',
            'password' => $password,
            'email_verified_at' => now(),
        ]);
        $client->profile()->create(['full_name' => 'Client User']);
        $client->roles()->create(['role' => 'client']);
    }
}
