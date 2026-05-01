<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Deliverable extends Model
{
    use HasUuids;

    protected $fillable = [
        'plan_id',
        'title',
        'type',
        'status',
        'due_date',
        'assigned_to',
        'description',
        'priority',
        'estimated_minutes',
        'approved_by',
        'approved_at',
    ];

    protected function casts(): array
    {
        return [
            'due_date' => 'date',
            'approved_at' => 'datetime',
        ];
    }

    public function plan()
    {
        return $this->belongsTo(MonthlyPlan::class, 'plan_id');
    }

    public function assignedUser()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function comments()
    {
        return $this->hasMany(DeliverableComment::class)->orderBy('created_at', 'asc');
    }

    public function assets()
    {
        return $this->hasMany(DeliverableAsset::class);
    }
}
