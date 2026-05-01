<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DeliverableComment extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'deliverable_id',
        'user_id',
        'body',
    ];

    public function deliverable()
    {
        return $this->belongsTo(Deliverable::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function userProfile()
    {
        return $this->hasOneThrough(Profile::class, User::class, 'id', 'user_id', 'user_id', 'id');
    }
}
