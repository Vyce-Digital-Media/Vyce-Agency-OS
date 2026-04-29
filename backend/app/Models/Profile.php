<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Profile extends Model
{
    use HasUuids;

    protected $fillable = [
        'user_id',
        'full_name',
        'avatar_url',
        'internal_label',
        'expected_start_time',
        'salary_hourly',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
