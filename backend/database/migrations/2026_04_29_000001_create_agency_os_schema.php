<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password')->nullable();
            $table->string('google_id')->nullable()->unique();
            $table->rememberToken();
            $table->timestamps();
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignUuid('user_id')->nullable()->index()->constrained()->nullOnDelete();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });

        Schema::create('personal_access_tokens', function (Blueprint $table) {
            $table->id();
            $table->uuidMorphs('tokenable');
            $table->string('name');
            $table->string('token', 64)->unique();
            $table->text('abilities')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });

        Schema::create('profiles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('full_name')->default('');
            $table->string('avatar_url')->nullable();
            $table->string('internal_label')->nullable();
            $table->time('expected_start_time')->nullable();
            $table->decimal('salary_hourly', 10, 2)->nullable();
            $table->timestamps();
        });

        Schema::create('user_roles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->enum('role', ['admin', 'manager', 'team_member', 'client']);
            $table->unique('user_id');
            $table->index('role');
        });

        Schema::create('clients', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('contact_email')->nullable();
            $table->string('contact_phone')->nullable();
            $table->string('brand_color')->nullable()->default('#3B82F6');
            $table->string('logo_url')->nullable();
            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('contract_type')->nullable();
            $table->decimal('monthly_retainer', 12, 2)->nullable();
            $table->decimal('one_time_cost', 12, 2)->nullable();
            $table->timestamp('onboarded_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'is_active']);
            $table->index('created_by');
        });

        Schema::create('monthly_plans', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('client_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('month');
            $table->unsignedSmallInteger('year');
            $table->unsignedInteger('total_deliverables')->default(0);
            $table->string('status')->default('draft');
            $table->text('notes')->nullable();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->json('deliverables_breakdown')->nullable();
            $table->text('description')->nullable();
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->string('plan_type')->default('monthly');
            $table->timestamps();

            $table->unique(['client_id', 'month', 'year']);
            $table->index(['status', 'start_date', 'end_date']);
        });

        Schema::create('deliverables', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('plan_id')->constrained('monthly_plans')->cascadeOnDelete();
            $table->string('title');
            $table->enum('type', ['post', 'reel', 'story', 'ad', 'campaign', 'blog', 'newsletter', 'other'])->default('post');
            $table->enum('status', ['not_started', 'in_progress', 'in_review', 'needs_approval', 'approved', 'delivered'])->default('not_started');
            $table->date('due_date')->nullable();
            $table->foreignUuid('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->text('description')->nullable();
            $table->string('priority')->default('medium');
            $table->foreignUuid('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();

            $table->index(['assigned_to', 'status']);
            $table->index(['plan_id', 'due_date']);
        });

        Schema::create('deliverable_assets', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('deliverable_id')->constrained()->cascadeOnDelete();
            $table->string('file_name');
            $table->string('file_url');
            $table->string('file_type')->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->foreignUuid('uploaded_by')->constrained('users')->cascadeOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->index('uploaded_by');
        });

        Schema::create('client_assets', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('client_id')->constrained()->cascadeOnDelete();
            $table->string('file_name');
            $table->string('file_url');
            $table->string('file_type')->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->foreignUuid('uploaded_by')->constrained('users')->cascadeOnDelete();
            $table->string('category')->default('other');
            $table->string('asset_name')->nullable();
            $table->string('content_type')->default('file');
            $table->text('notes')->nullable();
            $table->string('section')->default('general');
            $table->timestamp('created_at')->useCurrent();

            $table->index(['client_id', 'category']);
            $table->index('uploaded_by');
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->text('body')->nullable();
            $table->string('type');
            $table->foreignUuid('deliverable_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('link')->nullable();
            $table->boolean('is_read')->default(false);
            $table->timestamp('created_at')->useCurrent();

            $table->index(['user_id', 'is_read', 'created_at']);
        });

        Schema::create('time_entries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->timestamp('clock_in');
            $table->timestamp('clock_out')->nullable();
            $table->unsignedInteger('duration_minutes')->nullable();
            $table->boolean('is_break')->default(false);
            $table->text('notes')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['user_id', 'date']);
            $table->index(['user_id', 'date', 'is_break']);
            $table->index('date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('time_entries');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('client_assets');
        Schema::dropIfExists('deliverable_assets');
        Schema::dropIfExists('deliverables');
        Schema::dropIfExists('monthly_plans');
        Schema::dropIfExists('clients');
        Schema::dropIfExists('user_roles');
        Schema::dropIfExists('profiles');
        Schema::dropIfExists('personal_access_tokens');
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('users');
    }
};
