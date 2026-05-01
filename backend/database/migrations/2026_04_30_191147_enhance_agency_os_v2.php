<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('deliverables', function (Blueprint $table) {
            $table->unsignedInteger('estimated_minutes')->nullable()->after('priority');
        });

        Schema::create('deliverable_comments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('deliverable_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->text('body');
            $table->timestamps();

            $table->index(['deliverable_id', 'created_at']);
        });

        Schema::create('brand_kits', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('client_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('category'); // logo, color, font, asset
            $table->text('content')->nullable(); // hex codes, text, etc.
            $table->string('file_url')->nullable();
            $table->string('link_url')->nullable();
            $table->timestamps();

            $table->index('client_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('brand_kits');
        Schema::dropIfExists('deliverable_comments');
        Schema::table('deliverables', function (Blueprint $table) {
            $table->dropColumn('estimated_minutes');
        });
    }
};
