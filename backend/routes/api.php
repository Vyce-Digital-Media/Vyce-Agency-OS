<?php

use App\Http\Controllers\Api\AssetController;
use App\Http\Controllers\Api\AttendanceController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BrandKitController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\ClientPortalController;
use App\Http\Controllers\Api\CommentController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DeliverableController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PlanController;
use App\Http\Controllers\Api\TeamController;
use Illuminate\Support\Facades\Route;

Route::get('/asset-download/{bucket}/{asset}', [AssetController::class, 'download'])
    ->middleware('signed')
    ->name('asset.download')
    ->whereIn('bucket', ['client-assets', 'deliverable-assets']);

Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);
    Route::get('/google/redirect', [AuthController::class, 'googleRedirect']);
    Route::get('/google/callback', [AuthController::class, 'googleCallback']);
});

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::patch('/auth/profile', [AuthController::class, 'updateProfile']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::apiResource('clients', ClientController::class);
    Route::get('/clients/{client}/brand-kits', [BrandKitController::class, 'index']);
    Route::post('/clients/{client}/brand-kits', [BrandKitController::class, 'store']);
    Route::delete('/brand-kits/{brandKit}', [BrandKitController::class, 'destroy']);

    Route::apiResource('plans', PlanController::class);
    Route::apiResource('deliverables', DeliverableController::class);
    Route::get('/deliverables/{deliverable}/comments', [CommentController::class, 'index']);
    Route::post('/deliverables/{deliverable}/comments', [CommentController::class, 'store']);
    Route::delete('/comments/{comment}', [CommentController::class, 'destroy']);

    Route::get('/team', [TeamController::class, 'index']);
    Route::post('/team/invite', [TeamController::class, 'invite']);
    Route::delete('/team/{user}', [TeamController::class, 'remove']);
    Route::patch('/team/{user}/role', [TeamController::class, 'updateRole']);
    Route::patch('/team/{user}/profile', [TeamController::class, 'updateProfile']);
    Route::get('/team/salaries', [TeamController::class, 'salaries']);

    Route::get('/attendance', [AttendanceController::class, 'index']);
    Route::post('/attendance', [AttendanceController::class, 'store']);
    Route::post('/attendance/clock-in', [AttendanceController::class, 'clockIn']);
    Route::post('/attendance/clock-out', [AttendanceController::class, 'clockOut']);
    Route::post('/attendance/break-start', [AttendanceController::class, 'breakStart']);
    Route::post('/attendance/break-end', [AttendanceController::class, 'breakEnd']);
    Route::patch('/attendance/{timeEntry}', [AttendanceController::class, 'update']);

    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::patch('/notifications/{notification}/read', [NotificationController::class, 'markRead']);
    Route::patch('/notifications/read-all', [NotificationController::class, 'markAllRead']);

    Route::post('/assets/{bucket}/{path}', [AssetController::class, 'store'])
        ->where('path', '.*')
        ->whereIn('bucket', ['client-assets', 'deliverable-assets']);
    Route::get('/assets/{bucket}/{asset}/signed-url', [AssetController::class, 'signedUrl'])
        ->whereIn('bucket', ['client-assets', 'deliverable-assets']);
    Route::delete('/assets/{bucket}/{asset}', [AssetController::class, 'destroy'])
        ->whereIn('bucket', ['client-assets', 'deliverable-assets']);

    Route::get('/deliverable_assets', [AssetController::class, 'indexDeliverableAssets']);
    Route::post('/deliverable_assets', [AssetController::class, 'storeDeliverableAsset']);
    Route::delete('/deliverable_assets', [AssetController::class, 'destroyDeliverableAsset']);

    Route::get('/client_assets', [AssetController::class, 'indexClientAssets']);
    Route::post('/client_assets', [AssetController::class, 'storeClientAsset']);
    Route::delete('/client_assets', [AssetController::class, 'destroyClientAsset']);

    Route::get('/portal', [ClientPortalController::class, 'dashboard']);
    Route::get('/portal/deliverables', [ClientPortalController::class, 'deliverables']);
});
