<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class TimeEntry extends Model
{
    use HasUuids;

    public const UPDATED_AT = null;

    protected $fillable = [
        'user_id',
        'date',
        'clock_in',
        'clock_out',
        'duration_seconds',
        'is_break',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'clock_in' => 'datetime',
            'clock_out' => 'datetime',
            'is_break' => 'boolean',
        ];
    }
}
