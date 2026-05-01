<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Client extends Model
{
    use HasUuids;

    protected $fillable = [
        'name',
        'contact_email',
        'contact_phone',
        'brand_color',
        'secondary_color',
        'brand_slogan',
        'logo_url',
        'notes',
        'is_active',
        'created_by',
        'user_id',
        'contract_type',
        'monthly_retainer',
        'one_time_cost',
        'onboarded_at',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'monthly_retainer' => 'decimal:2',
            'one_time_cost' => 'decimal:2',
            'onboarded_at' => 'datetime',
        ];
    }

    public function plans()
    {
        return $this->hasMany(MonthlyPlan::class);
    }

    public function brandKits()
    {
        return $this->hasMany(BrandKit::class);
    }

    public function assets()
    {
        return $this->hasMany(ClientAsset::class);
    }

    public function portalUser()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
