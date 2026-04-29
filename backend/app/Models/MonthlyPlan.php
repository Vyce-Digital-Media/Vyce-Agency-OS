<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class MonthlyPlan extends Model
{
    use HasUuids;

    protected $fillable = [
        'client_id',
        'month',
        'year',
        'total_deliverables',
        'status',
        'notes',
        'created_by',
        'deliverables_breakdown',
        'description',
        'start_date',
        'end_date',
        'plan_type',
    ];

    protected function casts(): array
    {
        return [
            'deliverables_breakdown' => 'array',
            'start_date' => 'date',
            'end_date' => 'date',
        ];
    }

    public function client()
    {
        return $this->belongsTo(Client::class);
    }

    public function deliverables()
    {
        return $this->hasMany(Deliverable::class, 'plan_id');
    }
}
