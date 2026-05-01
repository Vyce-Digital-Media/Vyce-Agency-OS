<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Profile;
use App\Models\User;
use App\Models\UserRole;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $credentials['email'])->first();
        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            return response()->json(['message' => 'Invalid credentials'], 422);
        }

        $payload = $this->userPayload($user);

        return response()->json([
            'token'   => $user->createToken('web')->plainTextToken,
            'user'    => $payload['user'],
            'profile' => $payload['profile'],
            'role'    => $payload['role'],
        ]);
    }

    public function me(Request $request)
    {
        $payload = $this->userPayload($request->user());

        return response()->json([
            'user'    => $payload['user'],
            'profile' => $payload['profile'],
            'role'    => $payload['role'],
        ]);
    }

    public function updateProfile(Request $request)
    {
        $data = $request->validate([
            'full_name'      => ['sometimes', 'string', 'max:255'],
            'internal_label' => ['sometimes', 'nullable', 'string', 'max:255'],
            'avatar_url'     => ['sometimes', 'nullable', 'string', 'max:2048'],
        ]);

        $profile = $request->user()->profile;
        if ($profile) {
            $profile->update($data);
        }

        $payload = $this->userPayload($request->user()->fresh());

        return response()->json([
            'user'    => $payload['user'],
            'profile' => $payload['profile'],
            'role'    => $payload['role'],
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['success' => true]);
    }

    public function forgotPassword(Request $request)
    {
        $request->validate(['email' => ['required', 'email']]);

        $status = Password::sendResetLink($request->only('email'));

        return $status === Password::RESET_LINK_SENT
            ? response()->json(['success' => true])
            : response()->json(['message' => __($status)], 422);
    }

    public function resetPassword(Request $request)
    {
        $request->validate([
            'token' => ['required'],
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->forceFill([
                    'password' => Hash::make($password),
                    'remember_token' => Str::random(60),
                    'email_verified_at' => $user->email_verified_at ?? now(),
                ])->save();

                event(new PasswordReset($user));
            }
        );

        return $status === Password::PASSWORD_RESET
            ? response()->json(['success' => true])
            : response()->json(['message' => __($status)], 422);
    }

    public function googleRedirect()
    {
        return response()->json([
            'url' => Socialite::driver('google')->stateless()->redirect()->getTargetUrl(),
        ]);
    }

    public function googleCallback()
    {
        $googleUser = Socialite::driver('google')->stateless()->user();

        $user = User::firstOrCreate(
            ['email' => $googleUser->getEmail()],
            [
                'password' => null,
                'google_id' => $googleUser->getId(),
                'email_verified_at' => now(),
            ]
        );

        $user->forceFill(['google_id' => $googleUser->getId()])->save();
        Profile::firstOrCreate(
            ['user_id' => $user->id],
            ['full_name' => $googleUser->getName() ?? '']
        );

        return redirect(rtrim(env('FRONTEND_URL', config('app.url')), '/') . '?token=' . $user->createToken('web')->plainTextToken);
    }

    private function userPayload(User $user): array
    {
        $user->loadMissing(['profile', 'roles']);

        return [
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
            ],
            'profile' => $user->profile,
            'role' => $user->primaryRole(),
        ];
    }
}
